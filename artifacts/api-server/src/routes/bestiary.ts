import { Router, type IRouter, type Request, type Response } from "express";
import { db, bestiary } from "@workspace/db";
import { gt } from "drizzle-orm";

const router: IRouter = Router();

router.get("/bestiary", async (_req: Request, res: Response) => {
  const rows = await db.select().from(bestiary).where(gt(bestiary.encounterCount, 0));
  res.json(
    rows.map((r) => ({
      key: r.key,
      name: r.name,
      lore: r.lore,
      level: r.level,
      locationId: r.locationId,
      firstEncounteredByName: r.firstEncounteredByName,
      firstEncounteredAt: r.firstEncounteredAt?.toISOString() ?? null,
      encounterCount: r.encounterCount,
    })),
  );
});

export default router;
