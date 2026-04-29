import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import { db, generatedQuests, npcs } from "@workspace/db";
import { desc, eq, inArray } from "drizzle-orm";
import { getCurrentCharacter } from "../game/characterService";
import {
  generateQuestForNpc,
  updateGeneratedQuestStatus,
} from "../game/questGenerator";
import { logger } from "../lib/logger";

const router: IRouter = Router();

/**
 * P3 — AI-generated quests endpoints.
 *
 *   GET  /quests/generated                          — list player's AI quests
 *   POST /npc/:npcId/quest/generate                 — ask the NPC for a new quest
 *   POST /quests/generated/:id/status { status }    — accept|decline|complete|fail
 */

router.get("/quests/generated", async (req: Request, res: Response) => {
  const c = await getCurrentCharacter(req.sessionId);
  if (!c) {
    res.json([]);
    return;
  }
  const rows = await db
    .select()
    .from(generatedQuests)
    .where(eq(generatedQuests.characterId, c.id))
    .orderBy(desc(generatedQuests.createdAt))
    .limit(40);
  const npcIds = [...new Set(rows.map((r) => r.npcId))];
  const npcRows = npcIds.length > 0 ? await db.select().from(npcs).where(inArray(npcs.id, npcIds)) : [];
  const nameById = new Map(npcRows.map((n) => [n.id, n.name]));
  res.json(
    rows.map((g) => ({
      id: g.id,
      npcId: g.npcId,
      npcName: nameById.get(g.npcId) ?? g.npcId,
      title: g.title,
      description: g.description,
      objective: g.objective,
      targetType: g.targetType,
      targetRef: g.targetRef,
      targetCount: g.targetCount,
      rewardSilver: g.rewardSilver,
      rewardExp: g.rewardExp,
      rewardRepDelta: g.rewardRepDelta,
      status: g.status,
      createdAt: g.createdAt.toISOString(),
      acceptedAt: g.acceptedAt?.toISOString() ?? null,
      completedAt: g.completedAt?.toISOString() ?? null,
    })),
  );
});

router.post("/npc/:npcId/quest/generate", async (req: Request, res: Response) => {
  const c = await getCurrentCharacter(req.sessionId);
  if (!c) {
    res.status(404).json({ error: "Персонаж не найден" });
    return;
  }
  const npcId = String(req.params["npcId"]);
  const [npc] = await db.select().from(npcs).where(eq(npcs.id, npcId)).limit(1);
  if (!npc) {
    res.status(404).json({ error: "Собеседник не найден" });
    return;
  }
  try {
    const { quest } = await generateQuestForNpc({ npc, character: c, log: logger });
    res.json({
      id: quest.id,
      npcId: quest.npcId,
      npcName: npc.name,
      title: quest.title,
      description: quest.description,
      objective: quest.objective,
      targetType: quest.targetType,
      targetRef: quest.targetRef,
      targetCount: quest.targetCount,
      rewardSilver: quest.rewardSilver,
      rewardExp: quest.rewardExp,
      rewardRepDelta: quest.rewardRepDelta,
      status: quest.status,
      createdAt: quest.createdAt.toISOString(),
    });
  } catch (err) {
    res.status(409).json({ error: (err as Error).message });
  }
});

const StatusBody = z.object({ status: z.enum(["accepted", "declined", "completed", "failed"]) });

router.post("/quests/generated/:id/status", async (req: Request, res: Response) => {
  const c = await getCurrentCharacter(req.sessionId);
  if (!c) {
    res.status(404).json({ error: "Персонаж не найден" });
    return;
  }
  const id = Number(req.params["id"]);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Некорректный идентификатор" });
    return;
  }
  const parsed = StatusBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Некорректный статус" });
    return;
  }
  const updated = await updateGeneratedQuestStatus(id, c.id, parsed.data.status);
  if (!updated) {
    res.status(404).json({ error: "Дело не найдено" });
    return;
  }
  res.json({
    id: updated.id,
    status: updated.status,
    rewardSilver: updated.rewardSilver,
    rewardExp: updated.rewardExp,
  });
});

export default router;
