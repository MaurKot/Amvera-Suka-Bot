import { Router, type IRouter, type Request, type Response } from "express";
import { SendDialogueBody, GiftNpcBody } from "@workspace/api-zod";
import { db, npcDialogues, characters, worldEvents, inventoryItems } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { ai } from "../lib/gemini";
import { publishEvent } from "../lib/realtime";
import { getCurrentCharacter } from "../game/characterService";
import { getCatalogItem, getShopCatalog, isMerchantRole } from "../game/shopCatalog";
import { buildFallbackNpcReply } from "../game/npcFallback";
import {
  adjustReputation,
  getDialogueHistory,
  getNpcById,
  getRecentLedgerFlags,
  getReputation,
  listNpcs,
  npcWithRep,
  serializeNpcWithRep,
} from "../game/npcService";
import { buildSystemPrompt } from "../game/promptBuilder";
import { getRace, getCharClass } from "../game/lore";
import { getRepLevel, toneToInfluence } from "../game/reputation";
import { getEventConfig } from "../game/events";
import { buildContextAnchor, renderAnchorForPrompt } from "../game/anchor";
import { NpcReplySchema, validateNarrative } from "../game/validator";

const router: IRouter = Router();

router.get("/npc", async (req: Request, res: Response) => {
  const c = await getCurrentCharacter(req.sessionId);
  if (!c) {
    res.json([]);
    return;
  }
  const locationId = typeof req.query["locationId"] === "string" ? req.query["locationId"] : undefined;
  const npcs = await listNpcs(locationId);
  const out = await Promise.all(npcs.map(async (n) => serializeNpcWithRep(await npcWithRep(c, n))));
  res.json(out);
});

router.get("/npc/:npcId", async (req: Request, res: Response) => {
  const c = await getCurrentCharacter(req.sessionId);
  if (!c) {
    res.status(404).json({ error: "Персонаж не найден" });
    return;
  }
  const n = await getNpcById(String(req.params["npcId"]));
  if (!n) {
    res.status(404).json({ error: "Этот собеседник не найден" });
    return;
  }
  res.json(serializeNpcWithRep(await npcWithRep(c, n)));
});

router.get("/npc/:npcId/dialogue", async (req: Request, res: Response) => {
  const c = await getCurrentCharacter(req.sessionId);
  if (!c) {
    res.json([]);
    return;
  }
  const history = await getDialogueHistory(c.id, String(req.params["npcId"]));
  res.json(
    history.map((m) => ({
      id: m.id,
      role: m.role as "player" | "npc" | "system",
      content: m.content,
      createdAt: m.createdAt.toISOString(),
    })),
  );
});

router.post("/npc/:npcId/dialogue", async (req: Request, res: Response) => {
  const parsed = SendDialogueBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Слова не сложились" });
    return;
  }
  const c = await getCurrentCharacter(req.sessionId);
  if (!c) {
    res.status(404).json({ error: "Персонаж не найден" });
    return;
  }
  const npcId = String(req.params["npcId"]);
  const npc = await getNpcById(npcId);
  if (!npc) {
    res.status(404).json({ error: "Собеседник не найден" });
    return;
  }
  if (npc.locationId !== c.locationId) {
    res.status(400).json({ error: "Этого собеседника здесь нет" });
    return;
  }

  const reputation = await getReputation(c.id, npcId);
  const behavior = getRepLevel(reputation).behavior;
  if (behavior === "kill_on_sight" || behavior === "refuse_all") {
    const cannedReply =
      behavior === "kill_on_sight"
        ? `${npc.name} молча тянется к оружию. Слова здесь больше не нужны.`
        : `${npc.name} отворачивается. — Убирайся. Мне не о чем с тобой говорить.`;
    await db.insert(npcDialogues).values([
      { characterId: c.id, npcId, role: "player", content: parsed.data.content },
      { characterId: c.id, npcId, role: "npc", content: cannedReply },
    ]);
    res.json({
      npcReply: cannedReply,
      repDelta: 0,
      newReputation: reputation,
      repName: getRepLevel(reputation).nameRu,
      eventTriggered: null,
    });
    return;
  }

  const flags = await getRecentLedgerFlags(c.id);
  const history = await getDialogueHistory(c.id, npcId);
  const race = getRace(c.race);
  const cls = getCharClass(c.charClass);

  // L2 — Context anchor: tell Gemini what places/NPCs/items it is allowed to reference.
  const anchor = await buildContextAnchor(c.id);
  const anchorBlock = renderAnchorForPrompt(anchor);

  const basePrompt = buildSystemPrompt({
    npc,
    characterName: c.name,
    characterRace: race?.nameRu ?? c.race,
    characterClass: cls?.nameRu ?? c.charClass,
    reputation,
    recentFlags: flags,
    tone: parsed.data.tone,
    playerMessage: parsed.data.content,
    history: history.map((h) => ({ role: h.role, content: h.content })),
  });
  const prompt = `${anchorBlock}\n\n${basePrompt}`;

  let npcReply = "";
  let validationProblems: string[] = [];
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        temperature: 0.85,
        maxOutputTokens: 220,
      },
    });
    npcReply = (response.text ?? "").trim();
    if (!npcReply) {
      npcReply = `${npc.name} молчит, разглядывая тебя.`;
    }
    npcReply = npcReply.replace(/^(?:Ты|Я|NPC|"[^"]*"\s*:)\s*[:\-—]\s*/i, "").trim();

    // L1 — Schema validation
    const shapeCheck = NpcReplySchema.safeParse({ reply: npcReply });
    if (!shapeCheck.success) {
      req.log.warn({ npcReply }, "L1 schema rejected, using fallback");
      npcReply = `${npc.name} обрывает фразу на полуслове.`;
    }

    // L3 — Forbidden-fact validator
    const validation = validateNarrative(npcReply, anchor);
    validationProblems = validation.problems;
    if (!validation.ok) {
      req.log.warn({ problems: validation.problems, original: npcReply }, "L3 cleaned narrative");
      npcReply = validation.cleaned;
    }
  } catch (err) {
    req.log.warn({ err: (err as Error)?.message }, "Gemini dialogue call failed — using templated fallback");
    npcReply = buildFallbackNpcReply({
      npc,
      characterName: c.name,
      tone: parsed.data.tone,
      reputation,
      playerMessage: parsed.data.content,
    });
  }

  const influence = toneToInfluence(parsed.data.tone);
  const newRep = await adjustReputation(c.id, npcId, influence.rep);

  await db.insert(npcDialogues).values([
    { characterId: c.id, npcId, role: "player", content: parsed.data.content },
    { characterId: c.id, npcId, role: "npc", content: npcReply },
  ]);

  let eventTriggered: string | null = null;
  if (influence.flag) {
    const cfg = getEventConfig(influence.flag);
    eventTriggered = influence.flag;
    await db.insert(worldEvents).values({
      eventType: influence.flag,
      actorId: c.id,
      targetId: npcId,
      locationId: c.locationId,
      deltaRep: influence.rep,
      narrativeFlag: influence.flag,
      severity: cfg.sev,
      isPublic: cfg.public,
      description: `${cfg.defaultDescription} (${npc.name})`,
    });

    if (cfg.public) {
      await publishEvent({
        channel: "world",
        type: "narrative_flag",
        scope: c.locationId,
        payload: {
          flag: influence.flag,
          actorName: c.name,
          npcName: npc.name,
          locationId: c.locationId,
        },
      });
    }
  }

  await publishEvent({
    channel: "location",
    type: "npc_dialogue",
    scope: c.locationId,
    payload: {
      characterId: c.id,
      characterName: c.name,
      npcId,
      npcName: npc.name,
      locationId: c.locationId,
    },
  });

  res.json({
    npcReply,
    repDelta: influence.rep,
    newReputation: newRep,
    repName: getRepLevel(newRep).nameRu,
    eventTriggered,
    validationProblems,
  });
});

router.post("/npc/:npcId/gift", async (req: Request, res: Response) => {
  const parsed = GiftNpcBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Подношение не принято" });
    return;
  }
  const c = await getCurrentCharacter(req.sessionId);
  if (!c) {
    res.status(404).json({ error: "Персонаж не найден" });
    return;
  }
  const npcId = String(req.params["npcId"]);
  const npc = await getNpcById(npcId);
  if (!npc) {
    res.status(404).json({ error: "Собеседник не найден" });
    return;
  }
  if (parsed.data.silver > c.silver) {
    res.status(400).json({ error: "У тебя нет столько серебра" });
    return;
  }
  const repDelta = Math.min(80, Math.floor(parsed.data.silver * 1.5));
  const newRep = await adjustReputation(c.id, npcId, repDelta);
  await db
    .update(characters)
    .set({ silver: c.silver - parsed.data.silver })
    .where(eq(characters.id, c.id));

  const cfg = getEventConfig("gifted_rare_item");
  await db.insert(worldEvents).values({
    eventType: "gifted_rare_item",
    actorId: c.id,
    targetId: npcId,
    locationId: c.locationId,
    deltaRep: repDelta,
    narrativeFlag: "gifted_rare_item",
    severity: cfg.sev,
    isPublic: cfg.public,
    description: `Поднёс ${parsed.data.silver} серебра — ${npc.name}`,
  });

  res.json({
    reputation: newRep,
    repName: getRepLevel(newRep).nameRu,
    silverLeft: c.silver - parsed.data.silver,
    message: `${npc.name} принимает подношение и кивает.`,
  });
});

// --- Merchant / shop -------------------------------------------------------

router.get("/npc/:npcId/shop", async (req: Request, res: Response) => {
  const c = await getCurrentCharacter(req.sessionId);
  if (!c) {
    res.status(404).json({ error: "Персонаж не найден" });
    return;
  }
  const npcId = String(req.params["npcId"]);
  const npc = await getNpcById(npcId);
  if (!npc) {
    res.status(404).json({ error: "Собеседник не найден" });
    return;
  }
  if (!isMerchantRole(npc.role)) {
    res.status(400).json({ error: "Этот собеседник ничего не продаёт" });
    return;
  }
  const catalog = getShopCatalog(npcId);
  if (!catalog) {
    res.json({ npcId, npcName: npc.name, greeting: "Лавка пуста.", items: [], silver: c.silver });
    return;
  }
  res.json({
    npcId,
    npcName: npc.name,
    greeting: catalog.greeting,
    items: catalog.items,
    silver: c.silver,
  });
});

router.post("/npc/:npcId/shop/buy", async (req: Request, res: Response) => {
  const c = await getCurrentCharacter(req.sessionId);
  if (!c) {
    res.status(404).json({ error: "Персонаж не найден" });
    return;
  }
  const npcId = String(req.params["npcId"]);
  const npc = await getNpcById(npcId);
  if (!npc) {
    res.status(404).json({ error: "Собеседник не найден" });
    return;
  }
  if (npc.locationId !== c.locationId) {
    res.status(400).json({ error: "Этого торговца здесь нет" });
    return;
  }
  if (!isMerchantRole(npc.role)) {
    res.status(400).json({ error: "Этот собеседник ничего не продаёт" });
    return;
  }
  const catalogKey = typeof req.body?.catalogKey === "string" ? req.body.catalogKey : "";
  const item = getCatalogItem(npcId, catalogKey);
  if (!item) {
    res.status(404).json({ error: "Такого товара нет на прилавке" });
    return;
  }
  if (c.silver < item.price) {
    res.status(400).json({ error: "Не хватает серебра" });
    return;
  }

  // Stackable: increment quantity if existing same-key row exists.
  if (item.stackable) {
    const existing = await db
      .select()
      .from(inventoryItems)
      .where(
        and(
          eq(inventoryItems.characterId, c.id),
          eq(inventoryItems.itemKey, item.itemKey),
        ),
      )
      .limit(1);
    if (existing[0]) {
      await db
        .update(inventoryItems)
        .set({ quantity: existing[0].quantity + 1 })
        .where(eq(inventoryItems.id, existing[0].id));
    } else {
      await db.insert(inventoryItems).values({
        characterId: c.id,
        itemKey: item.itemKey,
        name: item.name,
        itemType: item.itemType,
        rarity: item.rarity,
        stats: item.stats,
        quantity: 1,
        equipped: false,
      });
    }
  } else {
    await db.insert(inventoryItems).values({
      characterId: c.id,
      itemKey: item.itemKey,
      name: item.name,
      itemType: item.itemType,
      rarity: item.rarity,
      stats: item.stats,
      quantity: 1,
      equipped: false,
    });
  }

  const newSilver = c.silver - item.price;
  await db.update(characters).set({ silver: newSilver }).where(eq(characters.id, c.id));

  // Small rep gain: regular customer.
  const newRep = await adjustReputation(c.id, npcId, 2);

  await db.insert(worldEvents).values({
    eventType: "shop_purchase",
    actorId: c.id,
    targetId: npcId,
    locationId: c.locationId,
    deltaRep: 2,
    narrativeFlag: "shop_purchase",
    severity: 1,
    isPublic: false,
    description: `Купил «${item.name}» у ${npc.name} за ${item.price} серебра`,
  });

  res.json({
    ok: true,
    purchased: { catalogKey: item.catalogKey, itemKey: item.itemKey, name: item.name, price: item.price },
    silverLeft: newSilver,
    reputation: newRep,
    message: `${npc.name} принимает серебро и протягивает «${item.name}».`,
  });
});

export default router;
