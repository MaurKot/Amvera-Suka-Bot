import {
  db,
  aiCycles,
  characters,
  worldEvents,
  npcs,
  locations,
  activeWorldEvents,
  generatedQuests,
  type AiCycle,
} from "@workspace/db";
import { and, desc, eq, gt, lt, sql } from "drizzle-orm";
import { z } from "zod";
import { ai } from "../lib/gemini";
import type { Logger } from "pino";
import { generateAdjacentLocation } from "./locationGenerator";

/**
 * P4 — Master AI cycle.
 *
 * Runs every `intervalMs` (configurable, default 6h) on a separate "track"
 * from the per-dialogue Gemini calls.
 *
 * Cycle:
 *  1. Build a compact World Report — # alive characters, recent rep changes,
 *     active events, frontier locations, NPC pulse.
 *  2. Ask Gemini for a small JSON of "directives" — bounded set of allowed
 *     actions: spawn_world_event, generate_location, none.
 *  3. Apply each directive defensively (validators, caps, idempotency).
 *  4. Write a row in `ai_cycles` for the admin panel.
 *
 * Safety guarantees:
 *  - Never deletes anything.
 *  - Caps: ≤1 new location per cycle, ≤1 new world event per cycle.
 *  - All effects of an event live in `active_world_events` with a TTL —
 *    they expire on their own without further AI involvement.
 */

const WORLD_DIRECTIVES_CAP = {
  newLocations: 1,
  newEvents: 1,
};

const DirectiveSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("spawn_world_event"),
    title: z.string().min(2).max(60),
    description: z.string().min(10).max(280),
    eventKind: z.enum(["caravan", "bandit_raid", "plague", "unrest", "festival", "custom"]),
    affectedLocations: z.array(z.string()).max(4),
    severity: z.number().int().min(1).max(5),
    durationHours: z.number().int().min(1).max(72),
  }),
  z.object({
    kind: z.literal("generate_location"),
    fromLocationId: z.string(),
    hint: z.string().max(80).optional(),
  }),
  z.object({
    kind: z.literal("none"),
    reason: z.string().max(160).optional(),
  }),
]);

const DirectivesPayload = z.object({
  directives: z.array(DirectiveSchema).max(4),
  flavorNotes: z.string().max(400).optional(),
});

interface WorldReport {
  characterCount: number;
  activeCharacters: number;
  topReputationFlags: { flag: string; count: number }[];
  recentPublicEvents: { description: string; createdAt: string }[];
  activeWorldEvents: { title: string; severity: number; expiresAt: string }[];
  frontierLocations: { id: string; name: string; region: string }[];
  generatedLocationCount: number;
  totalLocations: number;
  topNpcsByActivity: { id: string; name: string; questCount: number }[];
}

async function buildWorldReport(): Promise<WorldReport> {
  const charsQ = db.execute<{ count: string }>(sql`SELECT COUNT(*)::text AS count FROM characters`);
  const recentEventsQ = db
    .select()
    .from(worldEvents)
    .where(eq(worldEvents.isPublic, true))
    .orderBy(desc(worldEvents.createdAt))
    .limit(15);
  const activeEvtQ = db
    .select()
    .from(activeWorldEvents)
    .where(and(eq(activeWorldEvents.isActive, true), gt(activeWorldEvents.expiresAt, new Date())));
  const allLocsQ = db.select().from(locations);
  const recentQuestsQ = db
    .select({ npcId: generatedQuests.npcId, count: sql<number>`COUNT(*)::int` })
    .from(generatedQuests)
    .where(gt(generatedQuests.createdAt, new Date(Date.now() - 1000 * 60 * 60 * 24 * 7)))
    .groupBy(generatedQuests.npcId)
    .orderBy(desc(sql`COUNT(*)`))
    .limit(5);
  const recentFlagsQ = db
    .select({ flag: worldEvents.eventType, count: sql<number>`COUNT(*)::int` })
    .from(worldEvents)
    .where(gt(worldEvents.createdAt, new Date(Date.now() - 1000 * 60 * 60 * 24 * 3)))
    .groupBy(worldEvents.eventType)
    .orderBy(desc(sql`COUNT(*)`))
    .limit(8);
  // Proxy for "recently active": characters whose row was created in the last 24h.
  // (We don't store a per-action timestamp; this is sufficient for the director.)
  const recentlyActiveQ = db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(characters)
    .where(gt(characters.createdAt, new Date(Date.now() - 1000 * 60 * 60 * 24)));

  const [charsRes, recentEvts, activeEvts, allLocs, recentQuests, recentFlags, recentlyActive] = await Promise.all([
    charsQ,
    recentEventsQ,
    activeEvtQ,
    allLocsQ,
    recentQuestsQ,
    recentFlagsQ,
    recentlyActiveQ,
  ]);

  const npcMap = new Map<string, { id: string; name: string; questCount: number }>();
  if (recentQuests.length > 0) {
    const ids = recentQuests.map((r) => r.npcId);
    const npcRows = await db.select().from(npcs).where(sql`${npcs.id} = ANY(${ids})`);
    for (const r of recentQuests) {
      const n = npcRows.find((x) => x.id === r.npcId);
      if (n) npcMap.set(r.npcId, { id: n.id, name: n.name, questCount: r.count });
    }
  }

  const charsCount = Number((charsRes.rows?.[0] as { count?: string } | undefined)?.count ?? 0);

  return {
    characterCount: charsCount,
    activeCharacters: recentlyActive[0]?.count ?? 0,
    topReputationFlags: recentFlags.map((r) => ({ flag: r.flag, count: r.count })),
    recentPublicEvents: recentEvts.slice(0, 8).map((e) => ({
      description: e.description,
      createdAt: e.createdAt.toISOString(),
    })),
    activeWorldEvents: activeEvts.map((e) => ({
      title: e.title,
      severity: e.severity,
      expiresAt: e.expiresAt.toISOString(),
    })),
    frontierLocations: allLocs
      .filter((l) => l.isFrontier)
      .map((l) => ({ id: l.id, name: l.name, region: l.region })),
    generatedLocationCount: allLocs.filter((l) => l.isGenerated).length,
    totalLocations: allLocs.length,
    topNpcsByActivity: [...npcMap.values()],
  };
}

function buildDirectorPrompt(report: WorldReport): string {
  return `Ты — Великий Сценарист мрачного фэнтези мира Альтера. Раз в несколько часов ты получаешь сводку о мире и решаешь, нужно ли что-то изменить.

Твоя задача — поддерживать ощущение живого, опасного мира, не перегружая игроков.

ОТЧЁТ О МИРЕ (JSON):
${JSON.stringify(report, null, 2)}

ПРАВИЛА:
1. Если в мире уже идёт ${report.activeWorldEvents.length} активных событий, чаще выбирай "none".
2. Не создавай больше ${WORLD_DIRECTIVES_CAP.newLocations} новой локации за цикл.
3. Не создавай больше ${WORLD_DIRECTIVES_CAP.newEvents} нового события за цикл.
4. Локацию можно создавать только из списка frontierLocations.
5. Если активных игроков мало (<3) — почти всегда выбирай "none".

Верни JSON в формате:
{
  "directives": [
    { "kind": "spawn_world_event", "title": "...", "description": "...", "eventKind": "bandit_raid", "affectedLocations": ["ash_woods"], "severity": 3, "durationHours": 12 },
    { "kind": "generate_location", "fromLocationId": "ash_woods", "hint": "глубже в чащу" },
    { "kind": "none", "reason": "..." }
  ],
  "flavorNotes": "одно-два предложения внутреннего комментария"
}

ВАЖНО: только JSON. Никакого кода, никакого текста вне JSON.`;
}

function safeParseJsonBlock(text: string): unknown {
  const trimmed = text.trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  try { return JSON.parse(trimmed); } catch { /* */ }
  const match = /\{[\s\S]*\}/.exec(trimmed);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}

interface CycleOptions {
  triggeredBy?: "schedule" | "admin" | "startup";
  log: Logger;
}

export async function runWorldCycle(opts: CycleOptions): Promise<AiCycle> {
  const startedAt = Date.now();
  const [cycleRow] = await db
    .insert(aiCycles)
    .values({ cycleType: "world", triggeredBy: opts.triggeredBy ?? "schedule", status: "running" })
    .returning();

  if (!cycleRow) throw new Error("Failed to create AI cycle row");

  const cycleId = cycleRow.id;
  const applied: Record<string, unknown> = { newLocations: [], newEvents: [], skipped: [] };

  let report: WorldReport;
  let directives: z.infer<typeof DirectivesPayload> | null = null;
  let modelRaw = "";

  try {
    report = await buildWorldReport();

    // Skip Gemini call entirely on a near-empty world (cost savings)
    if (report.characterCount < 1) {
      await db
        .update(aiCycles)
        .set({
          status: "skipped",
          reportJson: report,
          appliedJson: { reason: "no_characters" },
          durationMs: Date.now() - startedAt,
          finishedAt: new Date(),
        })
        .where(eq(aiCycles.id, cycleId));
      opts.log.info({ cycleId }, "World cycle: skipped (empty world)");
      const [r] = await db.select().from(aiCycles).where(eq(aiCycles.id, cycleId)).limit(1);
      return r!;
    }

    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ role: "user", parts: [{ text: buildDirectorPrompt(report) }] }],
        config: { temperature: 0.7, maxOutputTokens: 600 },
      });
      modelRaw = (response.text ?? "").trim();
      const parsed = DirectivesPayload.safeParse(safeParseJsonBlock(modelRaw));
      if (parsed.success) directives = parsed.data;
      else opts.log.warn({ problems: parsed.error.issues, modelRaw }, "World cycle: directives rejected");
    } catch (err) {
      opts.log.warn({ err: (err as Error).message }, "World cycle: Gemini call failed, treating as no-op");
    }

    if (!directives) {
      directives = { directives: [{ kind: "none", reason: "model_unavailable_or_invalid" }] };
    }

    let newLocCount = 0;
    let newEvtCount = 0;
    const frontierIds = new Set(report.frontierLocations.map((f) => f.id));

    for (const d of directives.directives) {
      if (d.kind === "none") {
        (applied["skipped"] as unknown[]).push({ kind: "none", reason: d.reason ?? null });
        continue;
      }
      if (d.kind === "generate_location") {
        if (newLocCount >= WORLD_DIRECTIVES_CAP.newLocations) {
          (applied["skipped"] as unknown[]).push({ kind: d.kind, reason: "cap_reached" });
          continue;
        }
        if (!frontierIds.has(d.fromLocationId)) {
          (applied["skipped"] as unknown[]).push({ kind: d.kind, reason: "non_frontier_parent", fromLocationId: d.fromLocationId });
          continue;
        }
        const result = await generateAdjacentLocation({
          parentId: d.fromLocationId,
          log: opts.log,
          triggeredBy: "ai_cycle",
          hint: d.hint,
        });
        if (result) {
          (applied["newLocations"] as unknown[]).push({
            id: result.location.id,
            name: result.location.name,
            parentId: result.parentId,
            reason: result.reason,
          });
          newLocCount++;
        } else {
          (applied["skipped"] as unknown[]).push({ kind: d.kind, reason: "generator_returned_null" });
        }
      } else if (d.kind === "spawn_world_event") {
        if (newEvtCount >= WORLD_DIRECTIVES_CAP.newEvents) {
          (applied["skipped"] as unknown[]).push({ kind: d.kind, reason: "cap_reached" });
          continue;
        }
        const slug = `ai_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        const expiresAt = new Date(Date.now() + d.durationHours * 60 * 60 * 1000);
        const [evt] = await db
          .insert(activeWorldEvents)
          .values({
            slug,
            title: d.title.slice(0, 60),
            description: d.description.slice(0, 280),
            eventKind: d.eventKind,
            affectedLocationsJson: d.affectedLocations,
            severity: d.severity,
            sourceCycleId: cycleId,
            expiresAt,
          })
          .returning();
        await db.insert(worldEvents).values({
          eventType: `world_event_${d.eventKind}`,
          actorId: 0,
          targetId: slug,
          locationId: d.affectedLocations[0] ?? "ardvale_square",
          deltaRep: 0,
          narrativeFlag: "world_event",
          severity: d.severity,
          isPublic: true,
          description: `${d.title}: ${d.description}`,
        });
        (applied["newEvents"] as unknown[]).push({
          id: evt!.id,
          title: evt!.title,
          severity: evt!.severity,
          expiresAt: expiresAt.toISOString(),
        });
        newEvtCount++;
      }
    }

    await db
      .update(aiCycles)
      .set({
        status: "success",
        reportJson: report,
        directivesJson: directives,
        appliedJson: applied,
        durationMs: Date.now() - startedAt,
        finishedAt: new Date(),
      })
      .where(eq(aiCycles.id, cycleId));

    opts.log.info({ cycleId, applied }, "World cycle: complete");
  } catch (err) {
    opts.log.error({ err, cycleId }, "World cycle: failed");
    await db
      .update(aiCycles)
      .set({
        status: "error",
        error: (err as Error).message,
        durationMs: Date.now() - startedAt,
        finishedAt: new Date(),
      })
      .where(eq(aiCycles.id, cycleId));
  }

  // Sweep expired events back to inactive — cheap and idempotent.
  await db
    .update(activeWorldEvents)
    .set({ isActive: false })
    .where(and(eq(activeWorldEvents.isActive, true), lt(activeWorldEvents.expiresAt, new Date())));

  const [final] = await db.select().from(aiCycles).where(eq(aiCycles.id, cycleId)).limit(1);
  return final!;
}

let _scheduler: NodeJS.Timeout | null = null;

export function startWorldDirectorScheduler(log: Logger): void {
  if (_scheduler) return;
  // Default: every 6 hours. Override with WORLD_CYCLE_INTERVAL_MS for testing.
  const intervalMs = Number(process.env["WORLD_CYCLE_INTERVAL_MS"] ?? 6 * 60 * 60 * 1000);
  if (Number.isNaN(intervalMs) || intervalMs < 60_000) {
    log.warn({ intervalMs }, "World director: refusing to schedule (interval too small or invalid)");
    return;
  }
  _scheduler = setInterval(() => {
    runWorldCycle({ triggeredBy: "schedule", log }).catch((err) =>
      log.error({ err }, "World cycle scheduler iteration failed"),
    );
  }, intervalMs);
  // Detach so the interval doesn't block process shutdown.
  if (typeof _scheduler.unref === "function") _scheduler.unref();
  log.info({ intervalHours: (intervalMs / 1000 / 60 / 60).toFixed(1) }, "World director scheduler started");
}

export function stopWorldDirectorScheduler(): void {
  if (_scheduler) {
    clearInterval(_scheduler);
    _scheduler = null;
  }
}
