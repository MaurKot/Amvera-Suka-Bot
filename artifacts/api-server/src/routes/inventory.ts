import { Router, type IRouter, type Request, type Response } from "express";
import { EquipItemBody } from "@workspace/api-zod";
import { db, inventoryItems } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { getCurrentCharacter } from "../game/characterService";
import { serializeInventoryItem } from "../game/serializers";

const router: IRouter = Router();

router.get("/inventory", async (req: Request, res: Response) => {
  const c = await getCurrentCharacter(req.sessionId);
  if (!c) {
    res.json([]);
    return;
  }
  const items = await db
    .select()
    .from(inventoryItems)
    .where(eq(inventoryItems.characterId, c.id));
  res.json(items.map(serializeInventoryItem));
});

router.post("/inventory/equip", async (req: Request, res: Response) => {
  const parsed = EquipItemBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Неверный предмет" });
    return;
  }
  const c = await getCurrentCharacter(req.sessionId);
  if (!c) {
    res.status(404).json({ error: "Персонаж не найден" });
    return;
  }
  const rows = await db
    .select()
    .from(inventoryItems)
    .where(
      and(
        eq(inventoryItems.id, parsed.data.itemId),
        eq(inventoryItems.characterId, c.id),
      ),
    )
    .limit(1);
  const item = rows[0];
  if (!item) {
    res.status(404).json({ error: "Предмет не найден" });
    return;
  }
  if (item.itemType !== "weapon" && item.itemType !== "armor" && item.itemType !== "trinket") {
    res.status(400).json({ error: "Этот предмет нельзя надеть" });
    return;
  }
  // unequip same slot
  await db
    .update(inventoryItems)
    .set({ equipped: false })
    .where(
      and(
        eq(inventoryItems.characterId, c.id),
        eq(inventoryItems.itemType, item.itemType),
      ),
    );
  const updated = await db
    .update(inventoryItems)
    .set({ equipped: true })
    .where(eq(inventoryItems.id, item.id))
    .returning();
  res.json(serializeInventoryItem(updated[0]!));
});

export default router;
