import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import {
  db,
  npcs,
  locations,
  characters,
  worldEvents,
  activeWorldEvents,
  aiCycles,
  adminLog,
  generatedQuests,
  playerModeration,
} from "@workspace/db";
import { and, desc, eq, gt, sql } from "drizzle-orm";
import { adminAuth, logAdminAction } from "../middlewares/admin";
import { runWorldCycle } from "../game/worldDirector";
import { generateAdjacentLocation } from "../game/locationGenerator";
import { logger } from "../lib/logger";

/**
 * P5 — Admin panel API.
 *
 * Every route is gated by `adminAuth` (constant-time token check + audit log).
 * No sessions, no cookies — just `x-admin-token: <secret>` header.
 *
 * Routes are deliberately read-or-narrowly-write. We never let the admin
 * panel run arbitrary SQL; every mutation has a typed schema.
 */

const router: IRouter = Router();
router.use(adminAuth);

// Health check + summary -----------------------------------------------------
router.get("/admin/overview", async (req: Request, res: Response) => {
  const [
    charCountRow,
    npcCountRow,
    locCountRow,
    activeEvtCountRow,
    aiCyclesCountRow,
    questCountRow,
    bannedCountRow,
  ] = await Promise.all([
    db.execute<{ count: string }>(sql`SELECT COUNT(*)::text AS count FROM characters`),
    db.execute<{ count: string }>(sql`SELECT COUNT(*)::text AS count FROM npcs`),
    db.execute<{ count: string }>(sql`SELECT COUNT(*)::text AS count FROM locations`),
    db.execute<{ count: string }>(sql`SELECT COUNT(*)::text AS count FROM active_world_events WHERE is_active = true`),
    db.execute<{ count: string }>(sql`SELECT COUNT(*)::text AS count FROM ai_cycles`),
    db.execute<{ count: string }>(sql`SELECT COUNT(*)::text AS count FROM generated_quests`),
    db.execute<{ count: string }>(sql`SELECT COUNT(*)::text AS count FROM player_moderation WHERE is_banned = true`),
  ]);
  await logAdminAction(req.adminTokenLast6 ?? "?", "overview", null, null, {});
  res.json({
    characters: Number((charCountRow.rows?.[0] as { count?: string } | undefined)?.count ?? 0),
    npcs: Number((npcCountRow.rows?.[0] as { count?: string } | undefined)?.count ?? 0),
    locations: Number((locCountRow.rows?.[0] as { count?: string } | undefined)?.count ?? 0),
    activeEvents: Number((activeEvtCountRow.rows?.[0] as { count?: string } | undefined)?.count ?? 0),
    aiCycles: Number((aiCyclesCountRow.rows?.[0] as { count?: string } | undefined)?.count ?? 0),
    generatedQuests: Number((questCountRow.rows?.[0] as { count?: string } | undefined)?.count ?? 0),
    bannedPlayers: Number((bannedCountRow.rows?.[0] as { count?: string } | undefined)?.count ?? 0),
  });
});

// NPCs ----------------------------------------------------------------------
router.get("/admin/npcs", async (_req: Request, res: Response) => {
  const rows = await db.select().from(npcs).orderBy(npcs.tier, npcs.name);
  res.json(rows);
});

const NpcPatchSchema = z.object({
  shortProfile: z.string().min(2).max(2000).optional(),
  fullLore: z.string().max(4000).optional().nullable(),
  voiceStyle: z.string().min(2).max(800).optional(),
  knownFacts: z.string().min(2).max(2000).optional(),
  personality: z.string().min(2).max(80).optional(),
  motives: z.string().max(800).optional(),
  isHostile: z.boolean().optional(),
});

router.patch("/admin/npcs/:id", async (req: Request, res: Response) => {
  const id = String(req.params["id"]);
  const parsed = NpcPatchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Некорректные данные", issues: parsed.error.issues });
    return;
  }
  const [updated] = await db.update(npcs).set(parsed.data).where(eq(npcs.id, id)).returning();
  if (!updated) {
    res.status(404).json({ error: "NPC не найден" });
    return;
  }
  await logAdminAction(req.adminTokenLast6 ?? "?", "npc.update", "npc", id, parsed.data);
  res.json(updated);
});

// Locations -----------------------------------------------------------------
router.get("/admin/locations", async (_req: Request, res: Response) => {
  const rows = await db.select().from(locations).orderBy(locations.region, locations.name);
  res.json(rows);
});

const LocationPatchSchema = z.object({
  description: z.string().min(2).max(2000).optional(),
  isFrontier: z.boolean().optional(),
  isSafe: z.boolean().optional(),
});

router.patch("/admin/locations/:id", async (req: Request, res: Response) => {
  const id = String(req.params["id"]);
  const parsed = LocationPatchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Некорректные данные", issues: parsed.error.issues });
    return;
  }
  const [updated] = await db.update(locations).set(parsed.data).where(eq(locations.id, id)).returning();
  if (!updated) {
    res.status(404).json({ error: "Локация не найдена" });
    return;
  }
  await logAdminAction(req.adminTokenLast6 ?? "?", "location.update", "location", id, parsed.data);
  res.json(updated);
});

const GenerateLocBody = z.object({ fromLocationId: z.string().min(1), hint: z.string().max(80).optional() });

router.post("/admin/locations/generate", async (req: Request, res: Response) => {
  const parsed = GenerateLocBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Не указано место отправления" });
    return;
  }
  const result = await generateAdjacentLocation({
    parentId: parsed.data.fromLocationId,
    log: logger,
    triggeredBy: "admin",
    hint: parsed.data.hint,
  });
  if (!result) {
    res.status(409).json({ error: "Не удалось расширить мир из этой локации" });
    return;
  }
  await logAdminAction(req.adminTokenLast6 ?? "?", "location.generate", "location", result.location.id, {
    parentId: result.parentId,
    via: result.reason,
  });
  res.json({
    location: result.location,
    parentId: result.parentId,
    via: result.reason,
  });
});

// World events --------------------------------------------------------------
router.get("/admin/events/active", async (_req: Request, res: Response) => {
  const rows = await db
    .select()
    .from(activeWorldEvents)
    .where(and(eq(activeWorldEvents.isActive, true), gt(activeWorldEvents.expiresAt, new Date())))
    .orderBy(desc(activeWorldEvents.startsAt))
    .limit(50);
  res.json(rows);
});

const EventCreateSchema = z.object({
  title: z.string().min(2).max(60),
  description: z.string().min(2).max(280),
  eventKind: z.string().min(2).max(40),
  affectedLocations: z.array(z.string()).max(8),
  severity: z.number().int().min(1).max(5),
  durationHours: z.number().int().min(1).max(72),
});

router.post("/admin/events", async (req: Request, res: Response) => {
  const parsed = EventCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Некорректные данные", issues: parsed.error.issues });
    return;
  }
  const slug = `admin_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const expiresAt = new Date(Date.now() + parsed.data.durationHours * 60 * 60 * 1000);
  const [evt] = await db
    .insert(activeWorldEvents)
    .values({
      slug,
      title: parsed.data.title,
      description: parsed.data.description,
      eventKind: parsed.data.eventKind,
      affectedLocationsJson: parsed.data.affectedLocations,
      severity: parsed.data.severity,
      sourceCycleId: null,
      expiresAt,
    })
    .returning();
  await db.insert(worldEvents).values({
    eventType: `world_event_${parsed.data.eventKind}`,
    actorId: 0,
    targetId: slug,
    locationId: parsed.data.affectedLocations[0] ?? "ardvale_square",
    deltaRep: 0,
    narrativeFlag: "world_event_admin",
    severity: parsed.data.severity,
    isPublic: true,
    description: `${parsed.data.title}: ${parsed.data.description}`,
  });
  await logAdminAction(req.adminTokenLast6 ?? "?", "event.create", "event", slug, parsed.data);
  res.json(evt);
});

router.post("/admin/events/:id/end", async (req: Request, res: Response) => {
  const id = Number(req.params["id"]);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Некорректный id" });
    return;
  }
  const [updated] = await db
    .update(activeWorldEvents)
    .set({ isActive: false, expiresAt: new Date() })
    .where(eq(activeWorldEvents.id, id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Событие не найдено" });
    return;
  }
  await logAdminAction(req.adminTokenLast6 ?? "?", "event.end", "event", String(id), {});
  res.json(updated);
});

// AI cycles -----------------------------------------------------------------
router.get("/admin/ai-cycles", async (_req: Request, res: Response) => {
  const rows = await db.select().from(aiCycles).orderBy(desc(aiCycles.startedAt)).limit(20);
  res.json(rows);
});

router.post("/admin/ai-cycles/run", async (req: Request, res: Response) => {
  await logAdminAction(req.adminTokenLast6 ?? "?", "ai_cycle.run", null, null, {});
  // Run synchronously so the admin sees the result. World cycles are short.
  const result = await runWorldCycle({ triggeredBy: "admin", log: logger });
  res.json(result);
});

// Players / moderation ------------------------------------------------------
router.get("/admin/players", async (_req: Request, res: Response) => {
  const rows = await db
    .select({
      id: characters.id,
      name: characters.name,
      telegramId: characters.telegramId,
      telegramUsername: characters.telegramUsername,
      level: characters.level,
      experience: characters.experience,
      silver: characters.silver,
      locationId: characters.locationId,
      isAlive: characters.isAlive,
      createdAt: characters.createdAt,
    })
    .from(characters)
    .orderBy(desc(characters.createdAt))
    .limit(100);

  const moderation = await db.select().from(playerModeration);
  const modByChar = new Map(moderation.map((m) => [m.characterId, m]));
  res.json(
    rows.map((r) => ({
      ...r,
      createdAt: r.createdAt?.toISOString() ?? null,
      moderation: modByChar.get(r.id) ?? null,
    })),
  );
});

const BanBody = z.object({
  isBanned: z.boolean().optional(),
  isMuted: z.boolean().optional(),
  reason: z.string().max(400).optional().nullable(),
  warnDelta: z.number().int().min(-10).max(10).optional(),
});

router.post("/admin/players/:id/moderation", async (req: Request, res: Response) => {
  const id = Number(req.params["id"]);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Некорректный id" });
    return;
  }
  const parsed = BanBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Некорректные данные", issues: parsed.error.issues });
    return;
  }
  const tokenLast6 = req.adminTokenLast6 ?? "?";

  const [existing] = await db
    .select()
    .from(playerModeration)
    .where(eq(playerModeration.characterId, id))
    .limit(1);

  const now = new Date();
  if (existing) {
    const [updated] = await db
      .update(playerModeration)
      .set({
        isBanned: parsed.data.isBanned ?? existing.isBanned,
        isMuted: parsed.data.isMuted ?? existing.isMuted,
        warnCount: existing.warnCount + (parsed.data.warnDelta ?? 0),
        reason: parsed.data.reason !== undefined ? parsed.data.reason : existing.reason,
        updatedAt: now,
      })
      .where(eq(playerModeration.characterId, id))
      .returning();
    await logAdminAction(tokenLast6, "moderation.update", "character", String(id), parsed.data);
    res.json(updated);
  } else {
    const [created] = await db
      .insert(playerModeration)
      .values({
        characterId: id,
        isBanned: parsed.data.isBanned ?? false,
        isMuted: parsed.data.isMuted ?? false,
        warnCount: Math.max(0, parsed.data.warnDelta ?? 0),
        reason: parsed.data.reason ?? null,
        updatedAt: now,
      })
      .returning();
    await logAdminAction(tokenLast6, "moderation.create", "character", String(id), parsed.data);
    res.json(created);
  }
});

// Audit log -----------------------------------------------------------------
router.get("/admin/audit-log", async (_req: Request, res: Response) => {
  const rows = await db.select().from(adminLog).orderBy(desc(adminLog.createdAt)).limit(100);
  res.json(rows);
});

// Recent generated quests ---------------------------------------------------
router.get("/admin/generated-quests", async (_req: Request, res: Response) => {
  const rows = await db.select().from(generatedQuests).orderBy(desc(generatedQuests.createdAt)).limit(100);
  res.json(rows);
});

export default router;
