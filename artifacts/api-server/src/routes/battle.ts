import { Router, type IRouter, type Request, type Response } from "express";
import { StartBattleBody, BattleActionBody } from "@workspace/api-zod";
import { getCurrentCharacter } from "../game/characterService";
import { getActiveBattleFor, performAction, startBattle } from "../game/battleService";
import { serializeBattle } from "../game/serializers";

const router: IRouter = Router();

router.get("/battle", async (req: Request, res: Response) => {
  const c = await getCurrentCharacter(req.sessionId);
  if (!c) {
    res.json({ battle: null });
    return;
  }
  const b = await getActiveBattleFor(c.id);
  res.json({ battle: b ? serializeBattle(b) : null });
});

router.post("/battle/start", async (req: Request, res: Response) => {
  const parsed = StartBattleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Неверный враг" });
    return;
  }
  const c = await getCurrentCharacter(req.sessionId);
  if (!c) {
    res.status(404).json({ error: "Персонаж не найден" });
    return;
  }
  if (c.inBattle) {
    res.status(400).json({ error: "Ты уже в бою" });
    return;
  }
  if (c.hp <= 0) {
    res.status(400).json({ error: "Сначала отдохни — ты не в силах сражаться" });
    return;
  }
  try {
    const { battle } = await startBattle(c, parsed.data.enemyKey);
    res.json(serializeBattle(battle));
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

router.post("/battle/action", async (req: Request, res: Response) => {
  const parsed = BattleActionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Неверное действие" });
    return;
  }
  const c = await getCurrentCharacter(req.sessionId);
  if (!c) {
    res.status(404).json({ error: "Персонаж не найден" });
    return;
  }
  if (!c.inBattle) {
    res.status(400).json({ error: "Ты не в бою" });
    return;
  }
  try {
    const { battle } = await performAction(c, parsed.data.action);
    res.json(serializeBattle(battle));
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

export default router;
