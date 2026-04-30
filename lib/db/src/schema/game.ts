import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  real,
  uniqueIndex,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const characters = pgTable(
  "characters",
  {
    id: serial("id").primaryKey(),
    sessionId: text("session_id").notNull(),
    telegramId: text("telegram_id"),
    telegramUsername: text("telegram_username"),
    referralCode: text("referral_code"),
    referredBy: integer("referred_by"),
    name: text("name").notNull(),
    race: text("race").notNull(),
    charClass: text("char_class").notNull(),

    level: integer("level").notNull().default(1),
    experience: integer("experience").notNull().default(0),

    hp: integer("hp").notNull().default(100),
    maxHp: integer("max_hp").notNull().default(100),
    mana: integer("mana").notNull().default(50),
    maxMana: integer("max_mana").notNull().default(50),
    energy: integer("energy").notNull().default(3),
    maxEnergy: integer("max_energy").notNull().default(3),

    strength: integer("strength").notNull().default(10),
    agility: integer("agility").notNull().default(10),
    intelligence: integer("intelligence").notNull().default(10),
    endurance: integer("endurance").notNull().default(10),
    intuition: integer("intuition").notNull().default(10),
    luck: real("luck").notNull().default(1.0),

    statPoints: integer("stat_points").notNull().default(0),
    influencePoints: integer("influence_points").notNull().default(0),
    silver: integer("silver").notNull().default(50),

    locationId: text("location_id").notNull().default("ardvale_square"),
    inBattle: boolean("in_battle").notNull().default(false),
    isAlive: boolean("is_alive").notNull().default(true),

    totalKills: integer("total_kills").notNull().default(0),
    totalDeaths: integer("total_deaths").notNull().default(0),

    // ── v2 — Character psyche (hidden traits) ─────────────────────────────
    // Archetype is a derived label (brute / sneak / scholar / wanderer / loyal
    // / coward) computed from the four hidden trait counters. It stays null
    // until the player's behaviour clearly leans one way (server logic in
    // psycheService.ts). All four traits are 0..100 and never visible to NPC
    // dialog directly — instead they shape NPC fallback lines and reputation.
    archetype: text("archetype"),
    archetypeScores: jsonb("archetype_scores").notNull().default({}),
    cruelty: integer("cruelty").notNull().default(0),
    curiosity: integer("curiosity").notNull().default(0),
    loyalty: integer("loyalty").notNull().default(0),
    fearLevel: integer("fear_level").notNull().default(0),
    // Fame is the *public* counterpart of the hidden traits, surfaced through
    // every NPC interaction. -100..100. Grows with kills / quests, drops with
    // flight and defeats.
    fame: integer("fame").notNull().default(0),

    // Passive regen (replaces "rest at campfire" button).
    // We tick HP/Mana on every read of the character based on (now - lastRegenAt).
    lastRegenAt: timestamp("last_regen_at", { withTimezone: true }).defaultNow().notNull(),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    sessionIdx: uniqueIndex("characters_session_idx").on(t.sessionId),
    telegramIdx: uniqueIndex("characters_telegram_idx").on(t.telegramId),
    referralCodeIdx: uniqueIndex("characters_referral_code_idx").on(t.referralCode),
  }),
);

export const insertCharacterSchema = createInsertSchema(characters).omit({
  id: true,
  createdAt: true,
});
export type Character = typeof characters.$inferSelect;
export type InsertCharacter = z.infer<typeof insertCharacterSchema>;

export const npcs = pgTable("npcs", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  title: text("title"),
  tier: integer("tier").notNull().default(2),
  locationId: text("location_id").notNull(),
  faction: text("faction").notNull().default("neutral"),
  role: text("role").notNull(),
  shortProfile: text("short_profile").notNull(),
  fullLore: text("full_lore"),
  voiceStyle: text("voice_style").notNull(),
  knownFacts: text("known_facts"),
  secret: text("secret"),
  baseHp: integer("base_hp").notNull().default(60),
  baseDamage: integer("base_damage").notNull().default(8),
  level: integer("level").notNull().default(1),
  isHostile: boolean("is_hostile").notNull().default(false),
  // P3 — extended NPC profile for AI quest generation and dynamic behavior
  personality: text("personality").notNull().default("neutral"), // e.g. cautious, greedy, friendly
  motives: text("motives"), // what they want
  questPoolJson: jsonb("quest_pool_json").notNull().default([]), // suggested quest seeds
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type NPC = typeof npcs.$inferSelect;

export const npcDialogues = pgTable(
  "npc_dialogues",
  {
    id: serial("id").primaryKey(),
    characterId: integer("character_id").notNull(),
    npcId: text("npc_id").notNull(),
    role: text("role").notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    convIdx: index("dialogues_conv_idx").on(t.characterId, t.npcId, t.createdAt),
  }),
);
export type NPCDialogue = typeof npcDialogues.$inferSelect;

export const worldEvents = pgTable(
  "world_events",
  {
    id: serial("id").primaryKey(),
    eventType: text("event_type").notNull(),
    actorId: integer("actor_id").notNull(),
    targetId: text("target_id"),
    locationId: text("location_id"),
    deltaRep: integer("delta_rep").notNull().default(0),
    narrativeFlag: text("narrative_flag"),
    severity: integer("severity").notNull().default(1),
    isPublic: boolean("is_public").notNull().default(false),
    description: text("description").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    actorIdx: index("events_actor_idx").on(t.actorId, t.createdAt),
    targetIdx: index("events_target_idx").on(t.targetId, t.actorId),
  }),
);
export type WorldEvent = typeof worldEvents.$inferSelect;

export const characterReputation = pgTable(
  "character_reputation",
  {
    characterId: integer("character_id").notNull(),
    targetId: text("target_id").notNull(),
    targetType: text("target_type").notNull().default("npc"),
    reputation: integer("reputation").notNull().default(0),
    lastChangedAt: timestamp("last_changed_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.characterId, t.targetId] }),
    repIdx: index("rep_character_idx").on(t.characterId, t.reputation),
  }),
);
export type CharacterReputation = typeof characterReputation.$inferSelect;

export const inventoryItems = pgTable("inventory_items", {
  id: serial("id").primaryKey(),
  characterId: integer("character_id").notNull(),
  itemKey: text("item_key").notNull(),
  name: text("name").notNull(),
  itemType: text("item_type").notNull(),
  rarity: text("rarity").notNull().default("common"),
  stats: jsonb("stats").notNull().default({}),
  quantity: integer("quantity").notNull().default(1),
  equipped: boolean("equipped").notNull().default(false),
  obtainedAt: timestamp("obtained_at", { withTimezone: true }).defaultNow().notNull(),
});
export type InventoryItem = typeof inventoryItems.$inferSelect;

export const battles = pgTable("battles", {
  id: serial("id").primaryKey(),
  characterId: integer("character_id").notNull(),
  enemyKey: text("enemy_key").notNull(),
  enemyName: text("enemy_name").notNull(),
  enemyHp: integer("enemy_hp").notNull(),
  enemyMaxHp: integer("enemy_max_hp").notNull(),
  enemyDamage: integer("enemy_damage").notNull(),
  enemyLevel: integer("enemy_level").notNull().default(1),
  characterHp: integer("character_hp").notNull(),
  log: jsonb("log").notNull().default([]),
  status: text("status").notNull().default("active"),
  rewardSilver: integer("reward_silver").notNull().default(0),
  rewardExp: integer("reward_exp").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
export type Battle = typeof battles.$inferSelect;

export const locations = pgTable("locations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  region: text("region").notNull(),
  description: text("description").notNull(),
  type: text("type").notNull(),
  isSafe: boolean("is_safe").notNull().default(false),
  isStarter: boolean("is_starter").notNull().default(false),
  discoveredById: integer("discovered_by_id"),
  discoveredByName: text("discovered_by_name"),
  discoveredAt: timestamp("discovered_at", { withTimezone: true }),
  // P2 — Location graph + procedural generation
  connectedTo: jsonb("connected_to").notNull().default([]), // string[] of location ids
  coordX: real("coord_x").notNull().default(0), // schematic minimap layout
  coordY: real("coord_y").notNull().default(0),
  isFrontier: boolean("is_frontier").notNull().default(false), // true ⇒ AI may extend graph from here
  isGenerated: boolean("is_generated").notNull().default(false), // true ⇒ created by Master AI
  generatedAt: timestamp("generated_at", { withTimezone: true }),
  // City-level passages: when player tries to traverse a `requires_guard` passage,
  // a guard NPC warns about destination danger if level < destinationCityLevel.
  cityLevel: integer("city_level").notNull().default(0), // 0 = wilderness, >0 = settled
  requiresGuard: boolean("requires_guard").notNull().default(false), // gated traversal
  destinationCityId: text("destination_city_id"), // for passages: where they lead
  // ── v2 — Map UX: zone danger tier 0..5 (0 = safe city, 5 = lethal frontier).
  // Drives the colour ramp on the mini-map and the NPC guard warnings.
  // Seeded from `recommendedLevel` in lore.ts; AI-generated nodes inherit the
  // average of their neighbours.
  dangerLevel: integer("danger_level").notNull().default(0),
  recommendedLevel: integer("recommended_level").notNull().default(1),
});
export type Location = typeof locations.$inferSelect;

export const factions = pgTable("factions", {
  key: text("key").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  defaultRep: integer("default_rep").notNull().default(0),
  isHostile: boolean("is_hostile").notNull().default(false),
});
export type Faction = typeof factions.$inferSelect;

export const quests = pgTable("quests", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  type: text("type").notNull().default("general"),
  giverId: text("giver_id"),
  locationId: text("location_id"),
  objectives: jsonb("objectives").notNull().default([]),
  rewards: jsonb("rewards").notNull().default({}),
  isStarter: boolean("is_starter").notNull().default(false),
});
export type Quest = typeof quests.$inferSelect;

export const characterQuests = pgTable(
  "character_quests",
  {
    characterId: integer("character_id").notNull(),
    questId: text("quest_id").notNull(),
    status: text("status").notNull().default("available"),
    progress: jsonb("progress").notNull().default({}),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.characterId, t.questId] }),
    statusIdx: index("char_quests_status_idx").on(t.characterId, t.status),
  }),
);
export type CharacterQuest = typeof characterQuests.$inferSelect;

export const achievements = pgTable("achievements", {
  key: text("key").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  icon: text("icon").notNull().default("trophy"),
  buffJson: jsonb("buff_json").notNull().default({}),
  buffDurationSec: integer("buff_duration_sec").notNull().default(0),
});
export type Achievement = typeof achievements.$inferSelect;

export const characterAchievements = pgTable(
  "character_achievements",
  {
    characterId: integer("character_id").notNull(),
    achievementKey: text("achievement_key").notNull(),
    targetId: text("target_id"),
    earnedAt: timestamp("earned_at", { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.characterId, t.achievementKey, t.targetId] }),
    activeIdx: index("char_achievements_active_idx").on(t.characterId, t.expiresAt),
  }),
);
export type CharacterAchievement = typeof characterAchievements.$inferSelect;

export const bestiary = pgTable("bestiary", {
  key: text("key").primaryKey(),
  name: text("name").notNull(),
  lore: text("lore").notNull(),
  level: integer("level").notNull().default(1),
  locationId: text("location_id"),
  firstEncounteredById: integer("first_encountered_by_id"),
  firstEncounteredByName: text("first_encountered_by_name"),
  firstEncounteredAt: timestamp("first_encountered_at", { withTimezone: true }),
  encounterCount: integer("encounter_count").notNull().default(0),
});
export type Bestiary = typeof bestiary.$inferSelect;

export const referrals = pgTable(
  "referrals",
  {
    id: serial("id").primaryKey(),
    referrerId: integer("referrer_id").notNull(),
    refereeId: integer("referee_id").notNull(),
    code: text("code").notNull(),
    rewardSilver: integer("reward_silver").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    refereeIdx: uniqueIndex("referrals_referee_idx").on(t.refereeId),
    referrerIdx: index("referrals_referrer_idx").on(t.referrerId),
  }),
);
export type Referral = typeof referrals.$inferSelect;

// ---------------------------------------------------------------------------
// P3 — AI-generated quests (per NPC × character pair)
// ---------------------------------------------------------------------------

export const generatedQuests = pgTable(
  "generated_quests",
  {
    id: serial("id").primaryKey(),
    characterId: integer("character_id").notNull(),
    npcId: text("npc_id").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    objective: text("objective").notNull(), // free-form short objective
    targetType: text("target_type").notNull().default("talk"), // talk | kill | gather | explore | deliver
    targetRef: text("target_ref"), // location id, npc id or enemy key
    targetCount: integer("target_count").notNull().default(1),
    rewardSilver: integer("reward_silver").notNull().default(0),
    rewardExp: integer("reward_exp").notNull().default(0),
    rewardRepDelta: integer("reward_rep_delta").notNull().default(10),
    status: text("status").notNull().default("offered"), // offered | accepted | completed | failed | declined
    contextJson: jsonb("context_json").notNull().default({}), // generation inputs (debug)
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => ({
    activeIdx: index("gen_quests_active_idx").on(t.characterId, t.status),
    npcIdx: index("gen_quests_npc_idx").on(t.npcId, t.characterId),
  }),
);
export type GeneratedQuest = typeof generatedQuests.$inferSelect;

// ---------------------------------------------------------------------------
// P3 — NPC memory of player quest history (kept short for fast prompt access)
// ---------------------------------------------------------------------------

export const npcMemory = pgTable(
  "npc_memory",
  {
    npcId: text("npc_id").notNull(),
    characterId: integer("character_id").notNull(),
    memoryKey: text("memory_key").notNull(), // e.g. "quest_completed:<questId>"
    note: text("note").notNull(),
    sentiment: integer("sentiment").notNull().default(0), // -100..100, used by promptBuilder
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.npcId, t.characterId, t.memoryKey] }),
    charIdx: index("npc_memory_char_idx").on(t.characterId, t.npcId),
  }),
);
export type NpcMemory = typeof npcMemory.$inferSelect;

// ---------------------------------------------------------------------------
// P4 — Master AI cycles & directives (audit log)
// ---------------------------------------------------------------------------

export const aiCycles = pgTable(
  "ai_cycles",
  {
    id: serial("id").primaryKey(),
    cycleType: text("cycle_type").notNull().default("world"), // world | npc | location
    triggeredBy: text("triggered_by").notNull().default("schedule"), // schedule | admin | startup
    status: text("status").notNull().default("running"), // running | success | error | skipped
    reportJson: jsonb("report_json").notNull().default({}),
    directivesJson: jsonb("directives_json").notNull().default({}),
    appliedJson: jsonb("applied_json").notNull().default({}), // what changes actually landed
    error: text("error"),
    durationMs: integer("duration_ms").notNull().default(0),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => ({
    statusIdx: index("ai_cycles_status_idx").on(t.startedAt, t.status),
  }),
);
export type AiCycle = typeof aiCycles.$inferSelect;

// ---------------------------------------------------------------------------
// P6 — Active world events (lifecycle: scheduled → active → expired)
// ---------------------------------------------------------------------------

export const activeWorldEvents = pgTable(
  "active_world_events",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    eventKind: text("event_kind").notNull().default("custom"), // caravan | bandit_raid | plague | unrest | custom
    affectedLocationsJson: jsonb("affected_locations_json").notNull().default([]), // string[] of location ids; empty = world-wide
    effectsJson: jsonb("effects_json").notNull().default({}), // free-form effects (e.g. economy multiplier)
    severity: integer("severity").notNull().default(2), // 1..5
    isActive: boolean("is_active").notNull().default(true),
    cancelledByAdmin: boolean("cancelled_by_admin").notNull().default(false),
    sourceCycleId: integer("source_cycle_id"), // ai_cycles.id if AI-spawned
    startsAt: timestamp("starts_at", { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => ({
    activeIdx: index("active_events_active_idx").on(t.isActive, t.expiresAt),
  }),
);
export type ActiveWorldEvent = typeof activeWorldEvents.$inferSelect;

// ---------------------------------------------------------------------------
// P5 — Admin audit log (every privileged action)
// ---------------------------------------------------------------------------

export const adminLog = pgTable(
  "admin_log",
  {
    id: serial("id").primaryKey(),
    adminToken: text("admin_token").notNull(), // truncated/hashed token id (last 6 chars)
    action: text("action").notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
    payloadJson: jsonb("payload_json").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    timeIdx: index("admin_log_time_idx").on(t.createdAt),
  }),
);
export type AdminLog = typeof adminLog.$inferSelect;

// ---------------------------------------------------------------------------
// P5 — Player moderation state (ban / mute / warn)
// ---------------------------------------------------------------------------

export const playerModeration = pgTable(
  "player_moderation",
  {
    characterId: integer("character_id").primaryKey(),
    isBanned: boolean("is_banned").notNull().default(false),
    isMuted: boolean("is_muted").notNull().default(false),
    warnCount: integer("warn_count").notNull().default(0),
    flagCount: integer("flag_count").notNull().default(0), // auto-flag (suspicious behavior)
    reason: text("reason"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
);
export type PlayerModeration = typeof playerModeration.$inferSelect;
