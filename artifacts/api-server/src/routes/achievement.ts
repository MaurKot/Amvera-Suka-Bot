import { Router, type IRouter, type Request, type Response } from "express";
import { db, achievements, characterAchievements } from "@workspace/db";
import { and, eq, gt, isNull, or } from "drizzle-orm";
import { getCurrentCharacter } from "../game/characterService";

const router: IRouter = Router();

router.get("/achievements", async (req: Request, res: Response) => {
  const c = await getCurrentCharacter(req.sessionId);
  const all = await db.select().from(achievements);
  if (!c) {
    res.json(all.map((a) => ({ ...a, earned: false, count: 0, activeBuffExpiresAt: null })));
    return;
  }
  const earned = await db
    .select()
    .from(characterAchievements)
    .where(eq(characterAchievements.characterId, c.id));
  const now = new Date();
  res.json(
    all.map((a) => {
      const mine = earned.filter((e) => e.achievementKey === a.key);
      const active = mine.find((e) => !e.expiresAt || e.expiresAt > now);
      return {
        key: a.key,
        title: a.title,
        description: a.description,
        icon: a.icon,
        buffDurationSec: a.buffDurationSec,
        earned: mine.length > 0,
        count: mine.length,
        activeBuffExpiresAt: active?.expiresAt?.toISOString() ?? null,
        targets: mine.map((m) => ({
          targetId: m.targetId,
          earnedAt: m.earnedAt.toISOString(),
          expiresAt: m.expiresAt?.toISOString() ?? null,
        })),
      };
    }),
  );
});

router.get("/achievements/active-buffs", async (req: Request, res: Response) => {
  const c = await getCurrentCharacter(req.sessionId);
  if (!c) {
    res.json([]);
    return;
  }
  const now = new Date();
  const rows = await db
    .select()
    .from(characterAchievements)
    .where(
      and(
        eq(characterAchievements.characterId, c.id),
        or(isNull(characterAchievements.expiresAt), gt(characterAchievements.expiresAt, now)),
      ),
    );
  res.json(
    rows.map((r) => ({
      key: r.achievementKey,
      targetId: r.targetId,
      earnedAt: r.earnedAt.toISOString(),
      expiresAt: r.expiresAt?.toISOString() ?? null,
    })),
  );
});

export default router;
