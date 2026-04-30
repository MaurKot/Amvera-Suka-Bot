import { db, characters } from "@workspace/db";
import type { Character } from "@workspace/db";
import { eq } from "drizzle-orm";

// ─── v2 — Hidden character psyche ────────────────────────────────────────
//
// The four hidden traits (cruelty, curiosity, loyalty, fearLevel) plus the
// public `fame` score evolve quietly with what the player *does*, not with
// what they say. Combat outcomes feed this service from battleService;
// dialogue/quest hooks call it from the routes that own those flows.
//
// All values clamp to 0..100 (fame to -100..100). Updates are additive and
// idempotent — passing 0 is a no-op. The archetype label is recomputed on
// every update so the character page can reveal it the moment one trait
// clearly dominates.

export type PsycheDelta = Partial<{
  cruelty: number;
  curiosity: number;
  loyalty: number;
  fearLevel: number;
  fame: number;
}>;

const TRAIT_KEYS = ["cruelty", "curiosity", "loyalty", "fearLevel"] as const;
type TraitKey = (typeof TRAIT_KEYS)[number];

const ARCHETYPE_RU: Record<TraitKey, string> = {
  cruelty:   "Безжалостный",
  curiosity: "Искатель",
  loyalty:   "Верный",
  fearLevel: "Сломленный",
};

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/**
 * Decide the visible archetype label, or null if the psyche is still murky.
 * The dominant trait must be at least 25 *and* lead the runner-up by 12 to
 * surface — otherwise the character "hasn't shown their true colours yet".
 */
export function deriveArchetype(c: Pick<Character, "cruelty" | "curiosity" | "loyalty" | "fearLevel">): string | null {
  const scores: Array<[TraitKey, number]> = TRAIT_KEYS.map((k) => [k, c[k] ?? 0]);
  scores.sort((a, b) => b[1] - a[1]);
  const [topKey, topVal] = scores[0]!;
  const secondVal = scores[1]?.[1] ?? 0;
  if (topVal < 25) return null;
  if (topVal - secondVal < 12) return null;
  return ARCHETYPE_RU[topKey];
}

/**
 * Apply a delta to a character's psyche. Returns the freshly-updated row
 * so callers (battleService) can pass it back to the response serializer
 * without an extra round trip.
 */
export async function applyPsycheDelta(c: Character, delta: PsycheDelta): Promise<Character> {
  const next = {
    cruelty:   clamp((c.cruelty   ?? 0) + (delta.cruelty   ?? 0), 0, 100),
    curiosity: clamp((c.curiosity ?? 0) + (delta.curiosity ?? 0), 0, 100),
    loyalty:   clamp((c.loyalty   ?? 0) + (delta.loyalty   ?? 0), 0, 100),
    fearLevel: clamp((c.fearLevel ?? 0) + (delta.fearLevel ?? 0), 0, 100),
    fame:      clamp((c.fame      ?? 0) + (delta.fame      ?? 0), -100, 100),
  };
  const archetype = deriveArchetype(next);
  const rows = await db
    .update(characters)
    .set({ ...next, archetype })
    .where(eq(characters.id, c.id))
    .returning();
  return rows[0]!;
}

/**
 * Translate a battle outcome into a psyche delta.
 *
 *  - victory   → small fame, small cruelty, slight fear relief
 *  - kill      → fame + cruelty (kill is a victory that ended in a finisher)
 *  - defeat    → fear, drop fame
 *  - flee      → fear, drop fame
 *
 * Bigger fights (higher enemy level) push harder.
 */
export function battleOutcomeDelta(args: {
  outcome: "victory" | "defeat" | "fled";
  enemyLevel: number;
  finisher: boolean;
}): PsycheDelta {
  const scale = Math.max(1, Math.min(5, args.enemyLevel));
  if (args.outcome === "victory") {
    return {
      fame: scale,
      cruelty: args.finisher ? scale : Math.max(1, Math.round(scale / 2)),
      fearLevel: -1,
    };
  }
  if (args.outcome === "defeat") {
    return { fearLevel: scale, fame: -Math.max(1, Math.round(scale / 2)) };
  }
  // fled
  return { fearLevel: Math.max(1, Math.round(scale / 2)), fame: -1 };
}

/**
 * Translate a peaceful interaction (dialogue, quest pickup, exploration)
 * into a psyche delta. Used by NPC routes so that *talking* shapes the
 * character just as fighting does.
 */
export function dialogueOutcomeDelta(kind: "talk" | "quest_accept" | "quest_complete" | "discover" | "gift"): PsycheDelta {
  switch (kind) {
    case "talk":           return { curiosity: 1 };
    case "discover":       return { curiosity: 2 };
    case "quest_accept":   return { curiosity: 1, loyalty: 1 };
    case "quest_complete": return { loyalty: 3, fame: 2 };
    case "gift":           return { loyalty: 2, fame: 1 };
  }
}
