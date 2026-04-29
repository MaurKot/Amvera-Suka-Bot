import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import { db, locations, characterAchievements } from "@workspace/db";
import { and, eq, gt, isNull, or } from "drizzle-orm";
import { getCurrentCharacter } from "../game/characterService";
import { visitLocation } from "../game/locationService";
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
      buffActive: activeBuffsByLoc.has(l.id),
      buffExpiresAt: activeBuffsByLoc.get(l.id)?.toISOString() ?? null,
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
});

export default router;
