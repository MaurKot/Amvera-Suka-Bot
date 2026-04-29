import { db, generatedQuests, npcs, characters, locations, worldEvents, type GeneratedQuest, type NPC, type Character } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { ai } from "../lib/gemini";
import type { Logger } from "pino";
import type { QuestSeedTemplate } from "./npcSeed";
import { getReputation } from "./npcService";
import { getRepLevel } from "./reputation";

/**
 * P3 — AI quest generation.
 *
 * Pipeline:
 *  1. Refuse if NPC is hostile to the player or already has 1 active quest for them.
 *  2. Pick a seed from the NPC's quest pool (deterministic but varied per char).
 *  3. Ask Gemini to expand the seed into a short Russian quest description, with
 *     `targetType`, `targetRef`, `targetCount`, and reasonable rewards.
 *  4. Validate the response shape with Zod. On validation failure, fall back
 *     to the literal seed. We never trust the model to invent IDs — `targetRef`
 *     is anchored to the seed.
 */

const RewardSchema = z.object({
  silver: z.number().int().min(0).max(500),
  exp: z.number().int().min(0).max(800),
  reputation: z.number().int().min(-50).max(80).default(10),
});

const QuestModelOutput = z.object({
  title: z.string().min(2).max(80),
  description: z.string().min(8).max(360),
  objective: z.string().min(4).max(160),
  rewards: RewardSchema,
});

export interface GenerateQuestInput {
  npc: NPC;
  character: Character;
  log: Logger;
}

const MAX_ACTIVE_PER_CHARACTER_NPC = 1;

export async function getActiveGeneratedQuests(characterId: number): Promise<GeneratedQuest[]> {
  return db
    .select()
    .from(generatedQuests)
    .where(
      and(
        eq(generatedQuests.characterId, characterId),
        // any non-terminal status counts as “active”
      ),
    )
    .orderBy(desc(generatedQuests.createdAt))
    .limit(20);
}

export async function getActiveGeneratedQuestsForNpc(
  characterId: number,
  npcId: string,
): Promise<GeneratedQuest[]> {
  const rows = await db
    .select()
    .from(generatedQuests)
    .where(and(eq(generatedQuests.characterId, characterId), eq(generatedQuests.npcId, npcId)))
    .orderBy(desc(generatedQuests.createdAt))
    .limit(5);
  return rows.filter((r) => r.status === "offered" || r.status === "accepted");
}

function pickSeed(
  pool: QuestSeedTemplate[],
  history: GeneratedQuest[],
): QuestSeedTemplate | null {
  if (pool.length === 0) return null;
  const recentTitles = new Set(history.slice(0, 3).map((h) => h.title.toLowerCase()));
  const fresh = pool.filter((s) => !recentTitles.has(s.title.toLowerCase()));
  const candidates = fresh.length > 0 ? fresh : pool;
  return candidates[Math.floor(Math.random() * candidates.length)] ?? null;
}

function buildPrompt(npc: NPC, character: Character, seed: QuestSeedTemplate, locationName: string): string {
  return `Ты — ${npc.name}, ${npc.title ?? npc.role}.
Личность: ${npc.personality}. Мотивы: ${npc.motives ?? "—"}.
Ты говоришь с искателем по имени ${character.name} (${character.race}, ${character.charClass}, уровень ${character.level}) в локации «${locationName}».
Ты хочешь предложить ему дело. Тема: «${seed.title}». Суть: ${seed.brief}.

Сформулируй короткое поручение в формате JSON. Никакого текста вне JSON.

Правила:
1. Поле "title" — 2–6 слов на русском.
2. Поле "description" — 1–2 предложения на русском, в характере ${npc.personality}. Объясни ПОЧЕМУ ты просишь именно это, исходя из своих мотивов.
3. Поле "objective" — конкретное короткое задание на русском (что игрок должен сделать). НЕ упоминай очки, статы, ИИ, нейросети.
4. Поле "rewards" — { "silver": число, "exp": число, "reputation": число }. Серебро ≤ ${seed.rewardSilverHint ?? 60}, опыт ≤ ${seed.rewardExpHint ?? 90}.
5. Не используй эмодзи и цитаты.

Верни только JSON-объект.`;
}

function safeParseJsonBlock(text: string): unknown {
  const trimmed = text.trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // sometimes the model wraps things in extra prose — try to extract first {…}
    const match = /\{[\s\S]*\}/.exec(trimmed);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

export async function generateQuestForNpc(input: GenerateQuestInput): Promise<{
  quest: GeneratedQuest;
  refusedReason?: string;
}> {
  const { npc, character, log } = input;

  if (npc.locationId !== character.locationId) {
    throw new Error("NPC не находится в одной локации с игроком");
  }
  if (npc.isHostile) {
    throw new Error("Этот собеседник никогда не даст тебе дела");
  }

  // Refuse if rep too low
  const rep = await getReputation(character.id, npc.id);
  if (getRepLevel(rep).behavior === "refuse_all" || getRepLevel(rep).behavior === "kill_on_sight") {
    throw new Error(`${npc.name} не желает иметь с тобой дел`);
  }

  // Throttle: 1 active per (npc, char)
  const activeForNpc = await getActiveGeneratedQuestsForNpc(character.id, npc.id);
  if (activeForNpc.length >= MAX_ACTIVE_PER_CHARACTER_NPC) {
    throw new Error(`У тебя уже есть активное дело от ${npc.name}`);
  }

  const pool = (npc.questPoolJson as QuestSeedTemplate[] | null) ?? [];
  const history = await db
    .select()
    .from(generatedQuests)
    .where(and(eq(generatedQuests.characterId, character.id), eq(generatedQuests.npcId, npc.id)))
    .orderBy(desc(generatedQuests.createdAt))
    .limit(5);
  const seed = pickSeed(pool, history);
  if (!seed) {
    throw new Error(`У ${npc.name} нет для тебя дела`);
  }

  const [loc] = await db.select().from(locations).where(eq(locations.id, npc.locationId)).limit(1);
  const locationName = loc?.name ?? npc.locationId;

  // Defaults from seed (used as final fallback)
  let title = seed.title;
  let description = seed.brief;
  let objective = seed.brief;
  let rewardSilver = seed.rewardSilverHint ?? 40;
  let rewardExp = seed.rewardExpHint ?? 60;
  let rewardRepDelta = 10;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: buildPrompt(npc, character, seed, locationName) }] }],
      config: { temperature: 0.85, maxOutputTokens: 320 },
    });
    const raw = (response.text ?? "").trim();
    const parsed = QuestModelOutput.safeParse(safeParseJsonBlock(raw));
    if (parsed.success) {
      title = parsed.data.title.slice(0, 80);
      description = parsed.data.description.slice(0, 360);
      objective = parsed.data.objective.slice(0, 160);
      rewardSilver = Math.min(parsed.data.rewards.silver, (seed.rewardSilverHint ?? 60) + 20);
      rewardExp = Math.min(parsed.data.rewards.exp, (seed.rewardExpHint ?? 90) + 30);
      rewardRepDelta = Math.max(-50, Math.min(80, parsed.data.rewards.reputation));
    } else {
      log.warn({ npcId: npc.id, problems: parsed.error.issues, raw }, "Quest gen: model output rejected, using seed fallback");
    }
  } catch (err) {
    log.warn({ err: (err as Error).message, npcId: npc.id }, "Quest gen: Gemini call failed");
  }

  const [inserted] = await db
    .insert(generatedQuests)
    .values({
      characterId: character.id,
      npcId: npc.id,
      title,
      description,
      objective,
      targetType: seed.targetType,
      targetRef: seed.targetRef ?? null,
      targetCount: seed.targetCount ?? 1,
      rewardSilver,
      rewardExp,
      rewardRepDelta,
      status: "offered",
      contextJson: { seedTitle: seed.title, npcPersonality: npc.personality },
    })
    .returning();

  // World event so other systems / admin panel can see this happened
  await db.insert(worldEvents).values({
    eventType: "quest_offered",
    actorId: character.id,
    targetId: npc.id,
    locationId: npc.locationId,
    deltaRep: 0,
    narrativeFlag: "quest_offered",
    severity: 1,
    isPublic: false,
    description: `${npc.name} предложил(а) дело: «${title}»`,
  });

  return { quest: inserted };
}

/**
 * Mark a generated quest as accepted/declined/completed/failed.
 * Returns the updated row, or null if not found / not owned by caller.
 */
export async function updateGeneratedQuestStatus(
  id: number,
  characterId: number,
  status: "accepted" | "declined" | "completed" | "failed",
): Promise<GeneratedQuest | null> {
  const [row] = await db
    .select()
    .from(generatedQuests)
    .where(and(eq(generatedQuests.id, id), eq(generatedQuests.characterId, characterId)))
    .limit(1);
  if (!row) return null;
  const now = new Date();
  const patch: Partial<GeneratedQuest> = { status };
  if (status === "accepted") patch.acceptedAt = now;
  if (status === "completed" || status === "failed") patch.completedAt = now;

  // If completing → grant rewards
  if (status === "completed") {
    const [c] = await db.select().from(characters).where(eq(characters.id, characterId)).limit(1);
    if (c) {
      await db
        .update(characters)
        .set({
          silver: c.silver + row.rewardSilver,
          experience: c.experience + row.rewardExp,
        })
        .where(eq(characters.id, characterId));
    }
  }

  const [updated] = await db
    .update(generatedQuests)
    .set(patch)
    .where(eq(generatedQuests.id, id))
    .returning();
  return updated ?? null;
}
