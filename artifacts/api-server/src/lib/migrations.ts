import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import type { Logger } from "pino";

/**
 * Idempotent additive migrations. Run once on startup. Any structural change
 * here MUST be safe to apply against an already-populated production database.
 *
 * Why not drizzle-kit push at runtime?
 *   – We don't ship the kit binary in the production image.
 *   – Push can drop columns; we only ever ADD.
 */
export async function runStartupMigrations(log: Logger): Promise<void> {
  const t0 = Date.now();
  const steps: Array<[string, ReturnType<typeof sql>]> = [
    // ── P3: NPC profile extensions ─────────────────────────────────────────
    ["npcs.personality", sql`ALTER TABLE npcs ADD COLUMN IF NOT EXISTS personality text NOT NULL DEFAULT 'neutral'`],
    ["npcs.motives", sql`ALTER TABLE npcs ADD COLUMN IF NOT EXISTS motives text`],
    ["npcs.quest_pool_json", sql`ALTER TABLE npcs ADD COLUMN IF NOT EXISTS quest_pool_json jsonb NOT NULL DEFAULT '[]'::jsonb`],

    // ── P2: Location graph + procedural generation ────────────────────────
    ["locations.connected_to", sql`ALTER TABLE locations ADD COLUMN IF NOT EXISTS connected_to jsonb NOT NULL DEFAULT '[]'::jsonb`],
    ["locations.coord_x", sql`ALTER TABLE locations ADD COLUMN IF NOT EXISTS coord_x real NOT NULL DEFAULT 0`],
    ["locations.coord_y", sql`ALTER TABLE locations ADD COLUMN IF NOT EXISTS coord_y real NOT NULL DEFAULT 0`],
    ["locations.is_frontier", sql`ALTER TABLE locations ADD COLUMN IF NOT EXISTS is_frontier boolean NOT NULL DEFAULT false`],
    ["locations.is_generated", sql`ALTER TABLE locations ADD COLUMN IF NOT EXISTS is_generated boolean NOT NULL DEFAULT false`],
    ["locations.generated_at", sql`ALTER TABLE locations ADD COLUMN IF NOT EXISTS generated_at timestamptz`],

    // ── P3: AI-generated quests table ──────────────────────────────────────
    ["generated_quests", sql`
      CREATE TABLE IF NOT EXISTS generated_quests (
        id serial PRIMARY KEY,
        character_id integer NOT NULL,
        npc_id text NOT NULL,
        title text NOT NULL,
        description text NOT NULL,
        objective text NOT NULL,
        target_type text NOT NULL DEFAULT 'talk',
        target_ref text,
        target_count integer NOT NULL DEFAULT 1,
        reward_silver integer NOT NULL DEFAULT 0,
        reward_exp integer NOT NULL DEFAULT 0,
        reward_rep_delta integer NOT NULL DEFAULT 10,
        status text NOT NULL DEFAULT 'offered',
        context_json jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        accepted_at timestamptz,
        completed_at timestamptz
      )`],
    ["generated_quests.active_idx", sql`CREATE INDEX IF NOT EXISTS gen_quests_active_idx ON generated_quests (character_id, status)`],
    ["generated_quests.npc_idx", sql`CREATE INDEX IF NOT EXISTS gen_quests_npc_idx ON generated_quests (npc_id, character_id)`],

    // ── P3: NPC memory (per character) ─────────────────────────────────────
    ["npc_memory", sql`
      CREATE TABLE IF NOT EXISTS npc_memory (
        npc_id text NOT NULL,
        character_id integer NOT NULL,
        memory_key text NOT NULL,
        note text NOT NULL,
        sentiment integer NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (npc_id, character_id, memory_key)
      )`],
    ["npc_memory.char_idx", sql`CREATE INDEX IF NOT EXISTS npc_memory_char_idx ON npc_memory (character_id, npc_id)`],

    // ── P4: Master AI cycles ───────────────────────────────────────────────
    ["ai_cycles", sql`
      CREATE TABLE IF NOT EXISTS ai_cycles (
        id serial PRIMARY KEY,
        cycle_type text NOT NULL DEFAULT 'world',
        triggered_by text NOT NULL DEFAULT 'schedule',
        status text NOT NULL DEFAULT 'running',
        report_json jsonb NOT NULL DEFAULT '{}'::jsonb,
        directives_json jsonb NOT NULL DEFAULT '{}'::jsonb,
        applied_json jsonb NOT NULL DEFAULT '{}'::jsonb,
        error text,
        duration_ms integer NOT NULL DEFAULT 0,
        started_at timestamptz NOT NULL DEFAULT now(),
        finished_at timestamptz
      )`],
    ["ai_cycles.status_idx", sql`CREATE INDEX IF NOT EXISTS ai_cycles_status_idx ON ai_cycles (started_at, status)`],

    // ── P6: Active world events ────────────────────────────────────────────
    ["active_world_events", sql`
      CREATE TABLE IF NOT EXISTS active_world_events (
        id serial PRIMARY KEY,
        slug text NOT NULL,
        title text NOT NULL,
        description text NOT NULL,
        event_kind text NOT NULL DEFAULT 'custom',
        affected_locations_json jsonb NOT NULL DEFAULT '[]'::jsonb,
        effects_json jsonb NOT NULL DEFAULT '{}'::jsonb,
        severity integer NOT NULL DEFAULT 2,
        is_active boolean NOT NULL DEFAULT true,
        cancelled_by_admin boolean NOT NULL DEFAULT false,
        source_cycle_id integer,
        starts_at timestamptz NOT NULL DEFAULT now(),
        expires_at timestamptz NOT NULL
      )`],
    ["active_world_events.active_idx", sql`CREATE INDEX IF NOT EXISTS active_events_active_idx ON active_world_events (is_active, expires_at)`],

    // ── P5: Admin audit log + moderation ───────────────────────────────────
    ["admin_log", sql`
      CREATE TABLE IF NOT EXISTS admin_log (
        id serial PRIMARY KEY,
        admin_token text NOT NULL,
        action text NOT NULL,
        target_type text,
        target_id text,
        payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now()
      )`],
    ["admin_log.time_idx", sql`CREATE INDEX IF NOT EXISTS admin_log_time_idx ON admin_log (created_at)`],

    ["player_moderation", sql`
      CREATE TABLE IF NOT EXISTS player_moderation (
        character_id integer PRIMARY KEY,
        is_banned boolean NOT NULL DEFAULT false,
        is_muted boolean NOT NULL DEFAULT false,
        warn_count integer NOT NULL DEFAULT 0,
        flag_count integer NOT NULL DEFAULT 0,
        reason text,
        updated_at timestamptz NOT NULL DEFAULT now()
      )`],

    // ── Passive regeneration (replaces "rest at campfire" button) ─────────
    ["characters.last_regen_at", sql`ALTER TABLE characters ADD COLUMN IF NOT EXISTS last_regen_at timestamptz NOT NULL DEFAULT now()`],

    // ── City-level passages (Тропа Торговца guard checks) ─────────────────
    ["locations.city_level", sql`ALTER TABLE locations ADD COLUMN IF NOT EXISTS city_level integer NOT NULL DEFAULT 0`],
    ["locations.requires_guard", sql`ALTER TABLE locations ADD COLUMN IF NOT EXISTS requires_guard boolean NOT NULL DEFAULT false`],
    ["locations.destination_city_id", sql`ALTER TABLE locations ADD COLUMN IF NOT EXISTS destination_city_id text`],
  ];

  for (const [name, q] of steps) {
    try {
      await db.execute(q);
    } catch (err) {
      log.error({ err, step: name }, "Migration step failed");
      throw err;
    }
  }
  log.info({ steps: steps.length, ms: Date.now() - t0 }, "Startup migrations applied");
}
