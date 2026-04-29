import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import { db, quests, characterQuests, characters, worldEvents } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { getCurrentCharacter } from "../game/characterService";
import { adjustReputation } from "../game/npcService";
import { publishEvent } from "../lib/realtime";

const router: IRouter = Router();

router.get("/quests", async (req: Request, res: Response) => {
  const c = await getCurrentCharacter(req.sessionId);
  const all = await db.select().from(quests);
  if (!c) {
    res.json(all.map((q) => ({ ...q, status: "available", acceptedAt: null, completedAt: null })));
    return;
  }
  const owned = await db
    .select()
    .from(characterQuests)
    .where(eq(characterQuests.characterId, c.id));
  const ownedMap = new Map(owned.map((o) => [o.questId, o]));
  res.json(
    all.map((q) => {
      const o = ownedMap.get(q.id);
      return {
        id: q.id,
        title: q.title,
        description: q.description,
        type: q.type,
        giverId: q.giverId,
        locationId: q.locationId,
        objectives: q.objectives,
        rewards: q.rewards,
        isStarter: q.isStarter,
        status: o?.status ?? "available",
        progress: o?.progress ?? {},
        acceptedAt: o?.acceptedAt?.toISOString() ?? null,
        completedAt: o?.completedAt?.toISOString() ?? null,
      };
    }),
  );
});

const IdParam = z.object({ questId: z.string().min(1) });

router.post("/quests/:questId/accept", async (req: Request, res: Response) => {
  const params = IdParam.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Неверный квест" });
    return;
  }
  const c = await getCurrentCharacter(req.sessionId);
  if (!c) {
    res.status(404).json({ error: "Персонаж не найден" });
    return;
  }
  const [q] = await db.select().from(quests).where(eq(quests.id, params.data.questId)).limit(1);
  if (!q) {
    res.status(404).json({ error: "Квест не найден" });
    return;
  }
  await db
    .insert(characterQuests)
    .values({
      characterId: c.id,
      questId: q.id,
      status: "active",
      progress: {},
      acceptedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [characterQuests.characterId, characterQuests.questId],
      set: { status: "active", acceptedAt: new Date() },
    });
  await publishEvent({
    channel: "character",
    type: "quest_accepted",
    scope: String(c.id),
    payload: { questId: q.id, title: q.title },
  });
  res.json({ ok: true, questId: q.id, status: "active" });
});

router.post("/quests/:questId/complete", async (req: Request, res: Response) => {
  const params = IdParam.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Неверный квест" });
    return;
  }
  const c = await getCurrentCharacter(req.sessionId);
  if (!c) {
    res.status(404).json({ error: "Персонаж не найден" });
    return;
  }
  const [q] = await db.select().from(quests).where(eq(quests.id, params.data.questId)).limit(1);
  if (!q) {
    res.status(404).json({ error: "Квест не найден" });
    return;
  }
  const [cq] = await db
    .select()
    .from(characterQuests)
    .where(and(eq(characterQuests.characterId, c.id), eq(characterQuests.questId, q.id)))
    .limit(1);
  if (!cq || cq.status !== "active") {
    res.status(400).json({ error: "Квест не принят" });
    return;
  }

  const rewards = (q.rewards ?? {}) as {
    silver?: number;
    exp?: number;
    reputation?: Record<string, number>;
  };

  await db
    .update(characters)
    .set({
      silver: c.silver + (rewards.silver ?? 0),
      experience: c.experience + (rewards.exp ?? 0),
    })
    .where(eq(characters.id, c.id));

  if (rewards.reputation) {
    for (const [factionKey, delta] of Object.entries(rewards.reputation)) {
      await adjustReputation(c.id, factionKey, delta);
    }
  }

  await db
    .update(characterQuests)
    .set({ status: "completed", completedAt: new Date() })
    .where(and(eq(characterQuests.characterId, c.id), eq(characterQuests.questId, q.id)));

  await db.insert(worldEvents).values({
    eventType: "quest_completed",
    actorId: c.id,
    targetId: q.id,
    locationId: c.locationId,
    deltaRep: 0,
    narrativeFlag: "quest_completed",
    severity: 1,
    isPublic: true,
    description: `${c.name} завершил(а) дело «${q.title}».`,
  });

  await publishEvent({
    channel: "world",
    type: "quest_completed",
    scope: q.id,
    payload: { characterId: c.id, characterName: c.name, questId: q.id, title: q.title },
  });

  res.json({
    ok: true,
    questId: q.id,
    status: "completed",
    rewards: {
      silver: rewards.silver ?? 0,
      exp: rewards.exp ?? 0,
      reputation: rewards.reputation ?? {},
    },
  });
});

export default router;
