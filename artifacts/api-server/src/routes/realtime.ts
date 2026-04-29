import { Router, type IRouter, type Request, type Response } from "express";
import { subscribeSSE } from "../lib/realtime";

const router: IRouter = Router();

router.get("/events", async (req: Request, res: Response) => {
  res.set({
    "content-type": "text/event-stream",
    "cache-control": "no-cache, no-transform",
    "connection": "keep-alive",
    "x-accel-buffering": "no",
  });
  res.flushHeaders?.();
  res.write(`event: ready\ndata: ${JSON.stringify({ ts: Date.now(), sid: req.sessionId })}\n\n`);

  const unsubscribe = await subscribeSSE(res);
  const heartbeat = setInterval(() => {
    try {
      res.write(`: ping ${Date.now()}\n\n`);
    } catch {
      /* ignore */
    }
  }, 25_000);

  req.on("close", () => {
    clearInterval(heartbeat);
    unsubscribe();
    res.end();
  });
});

export default router;
