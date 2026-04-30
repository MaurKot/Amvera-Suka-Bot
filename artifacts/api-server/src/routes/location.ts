import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import { db, locations, characterAchievements, activeWorldEvents } from "@workspace/db";
import { and, eq, gt, isNull, or } from "drizzle-orm";
import { getCurrentCharacter } from "../game/characterService";
import { visitLocation, LocationNotConnectedError } from "../game/locationService";
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
      // P7 — passage / city-level metadata (Тропа Торговца guard system)
      cityLevel: l.cityLevel,
      requiresGuard: l.requiresGuard,
      destinationCityId: l.destinationCityId,
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
      // P7 — auto-discovery from frontier visit (replaces "Шагнуть за горизонт")
      discoveredNewPath: result.discoveredNewPath,
    });
  } catch (err) {
    if (err instanceof LocationNotConnectedError) {
      res.status(400).json({ error: "До этого места отсюда нет тропы" });
      return;
    }
    throw err;
  }
});

// ── P7: /locations/generate is REMOVED for players (frontier discovery is
// now automatic on visit, see locationService.ts auto-discovery). The endpoint
// remains under the admin route at /admin/locations/generate.
router.post("/locations/generate", async (_req: Request, res: Response) => {
  res
    .status(410)
    .json({ error: "Шаг за горизонт больше не нужен — новые тропы открываются сами на границах мира." });
});

// ── P7: Тропа Торговца guard check ───────────────────────────────────────
// Player calls this BEFORE attempting to traverse a `requiresGuard` passage.
// Returns the guard's warning if player level < destination city level + a
// computed combat-encounter chance (1 - level/destCityLevel) that the client
// may use to show a confirmation dialog.
const GuardCheckBody = z.object({ passageId: z.string().min(1) });

router.post("/locations/guard-check", async (req: Request, res: Response) => {
  const parsed = GuardCheckBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Не указана тропа" });
    return;
  }
  const c = await getCurrentCharacter(req.sessionId);
  if (!c) {
    res.status(404).json({ error: "Персонаж не найден" });
    return;
  }
  const [passage] = await db.select().from(locations).where(eq(locations.id, parsed.data.passageId)).limit(1);
  if (!passage || !passage.requiresGuard) {
    res.status(400).json({ error: "Эта дорога не охраняется" });
    return;
  }
  const destCityId = passage.destinationCityId;
  let destCityLevel = passage.cityLevel ?? 1;
  let destCityName = passage.name;
  if (destCityId) {
    const [dest] = await db.select().from(locations).where(eq(locations.id, destCityId)).limit(1);
    if (dest) {
      destCityLevel = dest.cityLevel ?? 1;
      destCityName = dest.name;
    }
  }
  // Combat encounter chance during transit (player request: 1 - lvl/destLvl)
  const encounterChance = Math.max(0, Math.min(1, 1 - c.level / Math.max(destCityLevel, 1)));
  const tooWeak = c.level < destCityLevel;
  res.json({
    passageId: passage.id,
    passageName: passage.name,
    destinationCityId: destCityId,
    destinationCityName: destCityName,
    destinationCityLevel: destCityLevel,
    playerLevel: c.level,
    tooWeak,
    encounterChance,
    warning: tooWeak
      ? `Стой, странник. ${destCityName} — город уровня ${destCityLevel}, а тебе ещё рано. На тропе тебя могут подстеречь разбойники. Шанс встречи — ${Math.round(encounterChance * 100)}%. Точно идёшь?`
      : `Дорога на ${destCityName} проходима. Будь осторожен — разбойники там встречаются с шансом ${Math.round(encounterChance * 100)}%.`,
  });
});

export default router;
