import { Router, type IRouter, type Request, type Response } from "express";
import { db, worldEvents } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { getCurrentCharacter } from "../game/characterService";
import { serializeLedger } from "../game/serializers";

const router: IRouter = Router();

router.get("/ledger", async (req: Request, res: Response) => {
  const c = await getCurrentCharacter(req.sessionId);
  if (!c) {
    res.json([]);
    return;
  }
  const events = await db
    .select()
    .from(worldEvents)
    .where(eq(worldEvents.actorId, c.id))
    .orderBy(desc(worldEvents.createdAt))
    .limit(100);
  res.json(events.map(serializeLedger));
});

export default router;
