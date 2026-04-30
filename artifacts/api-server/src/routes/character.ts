import { Router, type IRouter, type Request, type Response } from "express";
import {
  CreateCharacterBody,
  AllocateStatBody,
  MoveLocationBody,
} from "@workspace/api-zod";
import { db, characters } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  createCharacter,
  getCurrentCharacter,
  recomputeDerived,
} from "../game/characterService";
import { applyPassiveRegen } from "../game/regenService";
import { serializeCharacter } from "../game/serializers";
import { getLocation, getRace, getCharClass } from "../game/lore";

const router: IRouter = Router();

router.get("/character", async (req: Request, res: Response) => {
  const raw = await getCurrentCharacter(req.sessionId);
  if (!raw) {
    res.json({ character: null });
    return;
  }
  // Tick passive regeneration on every read — replaces the rest-at-campfire button.
  const { character, rate } = await applyPassiveRegen(raw);
  const serialized = serializeCharacter(character) as Record<string, unknown>;
  serialized["regen"] = rate; // { hpPerSec, manaPerSec, zone }
  res.json({ character: serialized });
});

router.post("/character", async (req: Request, res: Response) => {
  const parsed = CreateCharacterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Неверные данные персонажа", details: parsed.error.issues });
    return;
  }
  const existing = await getCurrentCharacter(req.sessionId);
  if (existing) {
    res.status(409).json({ error: "У тебя уже есть персонаж" });
    return;
  }
  if (!getRace(parsed.data.race)) {
    res.status(400).json({ error: "Неизвестная раса" });
    return;
  }
  if (!getCharClass(parsed.data.charClass)) {
    res.status(400).json({ error: "Неизвестный класс" });
    return;
  }
  const c = await createCharacter(
    req.sessionId,
    parsed.data.name.trim(),
    parsed.data.race,
    parsed.data.charClass,
  );
  res.json(serializeCharacter(c));
});

router.delete("/character", async (req: Request, res: Response) => {
  const c = await getCurrentCharacter(req.sessionId);
  if (!c) {
    res.json({ ok: true });
    return;
  }
  await db.delete(characters).where(eq(characters.id, c.id));
  res.json({ ok: true });
});

router.post("/character/allocate", async (req: Request, res: Response) => {
  const parsed = AllocateStatBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Неверный параметр" });
    return;
  }
  const c = await getCurrentCharacter(req.sessionId);
  if (!c) {
    res.status(404).json({ error: "Персонаж не найден" });
    return;
  }
  if (c.statPoints <= 0) {
    res.status(400).json({ error: "Нет свободных очков характеристик" });
    return;
  }
  const stat = parsed.data.stat;
  const updates: Partial<typeof c> = {
    statPoints: c.statPoints - 1,
    [stat]: (c[stat] as number) + 1,
  } as Partial<typeof c>;
  const projected = { ...c, ...updates } as typeof c;
  const derived = recomputeDerived(projected);
  const updated = await db
    .update(characters)
    .set({
      ...updates,
      maxHp: derived.maxHp,
      maxMana: derived.maxMana,
    })
    .where(eq(characters.id, c.id))
    .returning();
  res.json(serializeCharacter(updated[0]!));
});

// /character/rest — REMOVED. Replaced by passive HP/Mana regeneration that
// ticks on every GET /character call. See `regenService.ts`. The endpoint is
// kept as 410 Gone so old clients receive a clear, localized error instead of
// hanging on a 404.
router.post("/character/rest", async (_req: Request, res: Response) => {
  res
    .status(410)
    .json({ error: "Костёр больше не нужен — раны затягиваются сами, особенно в безопасных зонах." });
});

router.post("/character/move", async (req: Request, res: Response) => {
  const parsed = MoveLocationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Неверная локация" });
    return;
  }
  const c = await getCurrentCharacter(req.sessionId);
  if (!c) {
    res.status(404).json({ error: "Персонаж не найден" });
    return;
  }
  if (c.inBattle) {
    res.status(400).json({ error: "Нельзя путешествовать во время боя" });
    return;
  }
  const loc = getLocation(parsed.data.locationId);
  if (!loc) {
    res.status(400).json({ error: "Такой локации не существует" });
    return;
  }
  const updated = await db
    .update(characters)
    .set({ locationId: loc.id })
    .where(eq(characters.id, c.id))
    .returning();
  res.json(serializeCharacter(updated[0]!));
});

export default router;
