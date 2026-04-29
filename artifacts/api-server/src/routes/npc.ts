import { Router, type IRouter, type Request, type Response } from "express";
import { SendDialogueBody, GiftNpcBody } from "@workspace/api-zod";
import { db, npcDialogues, characters, worldEvents } from "@workspace/db";
import { eq } from "drizzle-orm";
import { ai } from "../lib/gemini";
import { getCurrentCharacter } from "../game/characterService";
import {
  adjustReputation,
  getDialogueHistory,
  getNpcById,
  getRecentLedgerFlags,
  getReputation,
  listNpcs,
  npcWithRep,
  serializeNpcWithRep,
} from "../game/npcService";
import { buildSystemPrompt } from "../game/promptBuilder";
import { getRace, getCharClass } from "../game/lore";
import { getRepLevel, toneToInfluence } from "../game/reputation";
import { getEventConfig } from "../game/events";

const router: IRouter = Router();

router.get("/npc", async (req: Request, res: Response) => {
  const c = await getCurrentCharacter(req.sessionId);
  if (!c) {
    res.json([]);
    return;
  }
  const locationId = typeof req.query["locationId"] === "string" ? req.query["locationId"] : undefined;
  const npcs = await listNpcs(locationId);
  const out = await Promise.all(npcs.map(async (n) => serializeNpcWithRep(await npcWithRep(c, n))));
  res.json(out);
});

router.get("/npc/:npcId", async (req: Request, res: Response) => {
  const c = await getCurrentCharacter(req.sessionId);
  if (!c) {
    res.status(404).json({ error: "Персонаж не найден" });
    return;
  }
  const n = await getNpcById(String(req.params["npcId"]));
  if (!n) {
    res.status(404).json({ error: "Этот собеседник не найден" });
    return;
  }
  res.json(serializeNpcWithRep(await npcWithRep(c, n)));
});

router.get("/npc/:npcId/dialogue", async (req: Request, res: Response) => {
  const c = await getCurrentCharacter(req.sessionId);
  if (!c) {
    res.json([]);
    return;
  }
  const history = await getDialogueHistory(c.id, String(req.params["npcId"]));
  res.json(
    history.map((m) => ({
      id: m.id,
      role: m.role as "player" | "npc" | "system",
      content: m.content,
      createdAt: m.createdAt.toISOString(),
    })),
  );
});

router.post("/npc/:npcId/dialogue", async (req: Request, res: Response) => {
  const parsed = SendDialogueBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Слова не сложились" });
    return;
  }
  const c = await getCurrentCharacter(req.sessionId);
  if (!c) {
    res.status(404).json({ error: "Персонаж не найден" });
    return;
  }
  const npcId = String(req.params["npcId"]);
  const npc = await getNpcById(npcId);
  if (!npc) {
    res.status(404).json({ error: "Собеседник не найден" });
    return;
  }
  if (npc.locationId !== c.locationId) {
    res.status(400).json({ error: "Этого собеседника здесь нет" });
    return;
  }

  const reputation = await getReputation(c.id, npcId);
  const behavior = getRepLevel(reputation).behavior;
  if (behavior === "kill_on_sight" || behavior === "refuse_all") {
    const cannedReply =
      behavior === "kill_on_sight"
        ? `${npc.name} молча тянется к оружию. Слова здесь больше не нужны.`
        : `${npc.name} отворачивается. — Убирайся. Мне не о чем с тобой говорить.`;
    await db.insert(npcDialogues).values([
      { characterId: c.id, npcId, role: "player", content: parsed.data.content },
      { characterId: c.id, npcId, role: "npc", content: cannedReply },
    ]);
    res.json({
      npcReply: cannedReply,
      repDelta: 0,
      newReputation: reputation,
      repName: getRepLevel(reputation).nameRu,
      eventTriggered: null,
    });
    return;
  }

  const flags = await getRecentLedgerFlags(c.id);
  const history = await getDialogueHistory(c.id, npcId);
  const race = getRace(c.race);
  const cls = getCharClass(c.charClass);

  const prompt = buildSystemPrompt({
    npc,
    characterName: c.name,
    characterRace: race?.nameRu ?? c.race,
    characterClass: cls?.nameRu ?? c.charClass,
    reputation,
    recentFlags: flags,
    tone: parsed.data.tone,
    playerMessage: parsed.data.content,
    history: history.map((h) => ({ role: h.role, content: h.content })),
  });

  let npcReply = "";
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        temperature: 0.85,
        maxOutputTokens: 220,
      },
    });
    npcReply = (response.text ?? "").trim();
    if (!npcReply) {
      npcReply = `${npc.name} молчит, разглядывая тебя.`;
    }
    // strip leading prefixes like "Ты:" if model leaks them
    npcReply = npcReply.replace(/^(?:Ты|Я|NPC|"[^"]*"\s*:)\s*[:\-—]\s*/i, "").trim();
  } catch (err) {
    req.log.error({ err }, "Gemini dialogue call failed");
    npcReply = `${npc.name} устало смотрит на тебя и не находит слов.`;
  }

  const influence = toneToInfluence(parsed.data.tone);
  const newRep = await adjustReputation(c.id, npcId, influence.rep);

  await db.insert(npcDialogues).values([
    { characterId: c.id, npcId, role: "player", content: parsed.data.content },
    { characterId: c.id, npcId, role: "npc", content: npcReply },
  ]);

  let eventTriggered: string | null = null;
  if (influence.flag) {
    const cfg = getEventConfig(influence.flag);
    eventTriggered = influence.flag;
    await db.insert(worldEvents).values({
      eventType: influence.flag,
      actorId: c.id,
      targetId: npcId,
      locationId: c.locationId,
      deltaRep: influence.rep,
      narrativeFlag: influence.flag,
      severity: cfg.sev,
      isPublic: cfg.public,
      description: `${cfg.defaultDescription} (${npc.name})`,
    });
  }

  res.json({
    npcReply,
    repDelta: influence.rep,
    newReputation: newRep,
    repName: getRepLevel(newRep).nameRu,
    eventTriggered,
  });
});

router.post("/npc/:npcId/gift", async (req: Request, res: Response) => {
  const parsed = GiftNpcBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Подношение не принято" });
    return;
  }
  const c = await getCurrentCharacter(req.sessionId);
  if (!c) {
    res.status(404).json({ error: "Персонаж не найден" });
    return;
  }
  const npcId = String(req.params["npcId"]);
  const npc = await getNpcById(npcId);
  if (!npc) {
    res.status(404).json({ error: "Собеседник не найден" });
    return;
  }
  if (parsed.data.silver > c.silver) {
    res.status(400).json({ error: "У тебя нет столько серебра" });
    return;
  }
  const repDelta = Math.min(80, Math.floor(parsed.data.silver * 1.5));
  const newRep = await adjustReputation(c.id, npcId, repDelta);
  await db
    .update(characters)
    .set({ silver: c.silver - parsed.data.silver })
    .where(eq(characters.id, c.id));

  const cfg = getEventConfig("gifted_rare_item");
  await db.insert(worldEvents).values({
    eventType: "gifted_rare_item",
    actorId: c.id,
    targetId: npcId,
    locationId: c.locationId,
    deltaRep: repDelta,
    narrativeFlag: "gifted_rare_item",
    severity: cfg.sev,
    isPublic: cfg.public,
    description: `Поднёс ${parsed.data.silver} серебра — ${npc.name}`,
  });

  res.json({
    reputation: newRep,
    repName: getRepLevel(newRep).nameRu,
    silverLeft: c.silver - parsed.data.silver,
    message: `${npc.name} принимает подношение и кивает.`,
  });
});

export default router;
