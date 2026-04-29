import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import { db, locations, characterAchievements, activeWorldEvents } from "@workspace/db";
import { and, eq, gt, isNull, or } from "drizzle-orm";
import { getCurrentCharacter } from "../game/characterService";
import { visitLocation, LocationNotConnectedError } from "../game/locationService";
import { generateAdjacentLocation } from "../game/locationGenerator";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.get("/locations", async (req: Request, res: Response) => {
  const c = await getCurrentCharacter(req.sessionId);
  const all = await db.select().from(locations);
  const now = new Date();
  let activeBuffsByLoc = new Map<string, Date | null>();
  if (c) {
    const buffs = await db
      .select()
      .from(characterAchievements)
      .where(
        and(
          eq(characterAchievements.characterId, c.id),
          eq(characterAchievements.achievementKey, "first_discoverer"),
          or(isNull(characterAchievements.expiresAt), gt(characterAchievements.expiresAt, now)),
        ),
      );
    activeBuffsByLoc = new Map(buffs.map((b) => [b.targetId ?? "", b.expiresAt]));
  }

  // P6 — bring active world events into the location list so the client can paint a
  // small "событие здесь" marker and gate dangerous actions.
  const activeEvents = await db
    .select()
    .from(activeWorldEvents)
    .where(and(eq(activeWorldEvents.isActive, true), gt(activeWorldEvents.expiresAt, now)));
  const eventsByLoc = new Map<string, { title: string; severity: number; eventKind: string }[]>();
  for (const ev of activeEvents) {
    const affected = (ev.affectedLocationsJson as string[] | null) ?? [];
    const targets = affected.length > 0 ? affected : all.map((l) => l.id); // world-wide
    for (const lid of targets) {
      const cur = eventsByLoc.get(lid) ?? [];
      cur.push({ title: ev.title, severity: ev.severity, eventKind: ev.eventKind });
      eventsByLoc.set(lid, cur);
    }
  }

  const currentNeighbors = new Set<string>();
  if (c) {
    const here = all.find((l) => l.id === c.locationId);
    for (const n of (here?.connectedTo as string[] | null) ?? []) currentNeighbors.add(n);
  }

  res.json(
    all.map((l) => ({
      id: l.id,
      name: l.name,
      region: l.region,
      description: l.description,
      type: l.type,
      isSafe: l.isSafe,
      isStarter: l.isStarter,
      isDiscovered: !!l.discoveredById,
      discoveredByName: l.discoveredByName,
      discoveredAt: l.discoveredAt?.toISOString() ?? null,
      isCurrent: c?.locationId === l.id,
      isReachable: c ? c.locationId === l.id || currentNeighbors.has(l.id) : false,
      buffActive: activeBuffsByLoc.has(l.id),
      buffExpiresAt: activeBuffsByLoc.get(l.id)?.toISOString() ?? null,
      // Graph + procedural metadata
      connectedTo: (l.connectedTo as string[] | null) ?? [],
      coordX: l.coordX,
      coordY: l.coordY,
      isFrontier: l.isFrontier,
      isGenerated: l.isGenerated,
      generatedAt: l.generatedAt?.toISOString() ?? null,
      activeEvents: eventsByLoc.get(l.id) ?? [],
    })),
  );
});

const VisitBody = z.object({ locationId: z.string().min(1) });

router.post("/locations/visit", async (req: Request, res: Response) => {
  const parsed = VisitBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Не указано место" });
    return;
  }
  const c = await getCurrentCharacter(req.sessionId);
  if (!c) {
    res.status(404).json({ error: "Персонаж не найден" });
    return;
  }
  if (c.inBattle) {
    res.status(409).json({ error: "Сначала закончи бой" });
    return;
  }
  try {
    const result = await visitLocation(c.id, parsed.data.locationId, logger);
    if (!result) {
      res.status(404).json({ error: "Место не существует" });
      return;
    }
    res.json({
      locationId: result.location.id,
      locationName: result.location.name,
      isFirstDiscoverer: result.isFirstDiscoverer,
      buffActive: result.buffActive,
      buffExpiresAt: result.buffExpiresAt?.toISOString() ?? null,
      achievementsAwarded: result.achievementsAwarded,
    });
  } catch (err) {
    if (err instanceof LocationNotConnectedError) {
      res.status(400).json({ error: "До этого места отсюда нет тропы" });
      return;
    }
    throw err;
  }
});

// ── P2: procedural location generation (player-triggered, throttled) ──────
const GenerateBody = z.object({ fromLocationId: z.string().min(1), hint: z.string().max(80).optional() });

router.post("/locations/generate", async (req: Request, res: Response) => {
  const parsed = GenerateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Не указано место отправления" });
    return;
  }
  const c = await getCurrentCharacter(req.sessionId);
  if (!c) {
    res.status(404).json({ error: "Персонаж не найден" });
    return;
  }
  if (c.locationId !== parsed.data.fromLocationId) {
    res.status(400).json({ error: "Расширять можно только с того места, где ты сейчас находишься" });
    return;
  }
  // Soft throttle: each character may trigger one generation per 30 minutes.
  // We use the world_events table as a poor man's audit log / rate limiter.
  const since = new Date(Date.now() - 1000 * 60 * 30);
  const recent = await db
    .select()
    .from(activeWorldEvents)
    .where(and(eq(activeWorldEvents.eventKind, "frontier_explore"), gt(activeWorldEvents.startsAt, since)))
    .limit(1);
  if (recent.length > 0) {
    res.status(429).json({ error: "Кто-то уже расширил мир за этим горизонтом — отдохни немного" });
    return;
  }

  const result = await generateAdjacentLocation({
    parentId: parsed.data.fromLocationId,
    log: logger,
    triggeredBy: "player",
    hint: parsed.data.hint,
  });
  if (!result) {
    res.status(409).json({ error: "Из этой локации нельзя расширять мир" });
    return;
  }

  res.json({
    location: {
      id: result.location.id,
      name: result.location.name,
      region: result.location.region,
      description: result.location.description,
      type: result.location.type,
      isSafe: result.location.isSafe,
      coordX: result.location.coordX,
      coordY: result.location.coordY,
      isGenerated: result.location.isGenerated,
    },
    parentId: result.parentId,
    via: result.reason,
  });
});

export default router;
