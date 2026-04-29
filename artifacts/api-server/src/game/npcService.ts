import { db, npcs, characterReputation, npcDialogues, worldEvents } from "@workspace/db";
import type { NPC, Character } from "@workspace/db";
import { and, eq, desc } from "drizzle-orm";
import { getRepLevel, clampReputation } from "./reputation";

export async function getNpcById(npcId: string): Promise<NPC | null> {
  const rows = await db.select().from(npcs).where(eq(npcs.id, npcId)).limit(1);
  return rows[0] ?? null;
}

export async function listNpcs(locationId?: string): Promise<NPC[]> {
  if (locationId) {
    return db.select().from(npcs).where(eq(npcs.locationId, locationId));
  }
  return db.select().from(npcs);
}

export async function getReputation(characterId: number, npcId: string): Promise<number> {
  const rows = await db
    .select()
    .from(characterReputation)
    .where(
      and(
        eq(characterReputation.characterId, characterId),
        eq(characterReputation.targetId, npcId),
      ),
    )
    .limit(1);
  return rows[0]?.reputation ?? 0;
}

export async function adjustReputation(
  characterId: number,
  npcId: string,
  delta: number,
): Promise<number> {
  const current = await getReputation(characterId, npcId);
  const newRep = clampReputation(current + delta);
  const existing = await db
    .select()
    .from(characterReputation)
    .where(
      and(
        eq(characterReputation.characterId, characterId),
        eq(characterReputation.targetId, npcId),
      ),
    )
    .limit(1);
  if (existing.length === 0) {
    await db.insert(characterReputation).values({
      characterId,
      targetId: npcId,
      targetType: "npc",
      reputation: newRep,
    });
  } else {
    await db
      .update(characterReputation)
      .set({ reputation: newRep, lastChangedAt: new Date() })
      .where(
        and(
          eq(characterReputation.characterId, characterId),
          eq(characterReputation.targetId, npcId),
        ),
      );
  }
  return newRep;
}

export async function getDialogueHistory(
  characterId: number,
  npcId: string,
  limit = 50,
) {
  return db
    .select()
    .from(npcDialogues)
    .where(
      and(eq(npcDialogues.characterId, characterId), eq(npcDialogues.npcId, npcId)),
    )
    .orderBy(npcDialogues.createdAt)
    .limit(limit);
}

export async function getRecentLedgerFlags(
  characterId: number,
  limit = 20,
): Promise<string[]> {
  const rows = await db
    .select({ flag: worldEvents.narrativeFlag })
    .from(worldEvents)
    .where(eq(worldEvents.actorId, characterId))
    .orderBy(desc(worldEvents.createdAt))
    .limit(limit);
  return rows.map((r) => r.flag).filter((f): f is string => !!f);
}

export interface NpcWithRep {
  npc: NPC;
  reputation: number;
}

export async function npcWithRep(c: Character, n: NPC): Promise<NpcWithRep> {
  const reputation = await getReputation(c.id, n.id);
  return { npc: n, reputation };
}

export function serializeNpcWithRep(input: NpcWithRep) {
  const lvl = getRepLevel(input.reputation);
  return {
    id: input.npc.id,
    name: input.npc.name,
    title: input.npc.title,
    role: input.npc.role,
    locationId: input.npc.locationId,
    shortProfile: input.npc.shortProfile,
    voiceStyle: input.npc.voiceStyle,
    faction: input.npc.faction,
    reputation: input.reputation,
    repName: lvl.nameRu,
    repIcon: lvl.icon,
    repBehavior: lvl.behavior,
    tier: input.npc.tier,
  };
}
