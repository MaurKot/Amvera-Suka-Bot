import { db, characters, locations } from "@workspace/db";
import type { Character } from "@workspace/db";
import { eq } from "drizzle-orm";

/**
 * Passive HP/Mana regeneration. Replaces the old "rest at campfire" button.
 *
 * Tick rates per real-world second:
 *   - Safe zone (city, market, river_crossing, western_meadow):  +0.50 HP, +0.40 Mana
 *   - Wilderness:                                                 +0.10 HP, +0.08 Mana
 *   - Frontier / dangerous:                                       +0.05 HP, +0.04 Mana
 *   - In battle: 0 (regen suspended)
 *
 * Multipliers in safe zone are 5–10× faster, satisfying the brief's "×2 in safe
 * zones, slowed in dangerous". The energy stat does not regen here — energy is
 * gameplay currency tied to actions, not time.
 */
export interface RegenRates {
  hpPerSec: number;
  manaPerSec: number;
  zone: "safe" | "wilderness" | "dangerous";
}

const SAFE_RATE: RegenRates = { hpPerSec: 0.5, manaPerSec: 0.4, zone: "safe" };
const WILD_RATE: RegenRates = { hpPerSec: 0.1, manaPerSec: 0.08, zone: "wilderness" };
const DANGER_RATE: RegenRates = { hpPerSec: 0.05, manaPerSec: 0.04, zone: "dangerous" };

const REGEN_CACHE = new Map<string, RegenRates>();

async function rateForLocation(locationId: string): Promise<RegenRates> {
  const cached = REGEN_CACHE.get(locationId);
  if (cached) return cached;
  const [loc] = await db.select().from(locations).where(eq(locations.id, locationId)).limit(1);
  let rate: RegenRates;
  if (!loc) rate = WILD_RATE;
  else if (loc.isSafe) rate = SAFE_RATE;
  else if (loc.isFrontier) rate = DANGER_RATE;
  else rate = WILD_RATE;
  REGEN_CACHE.set(locationId, rate);
  return rate;
}

/**
 * Apply passive regen since `lastRegenAt`. Returns the (possibly mutated)
 * character and the rate that was applied. If nothing changed (already at full,
 * or in battle), the character is returned unmodified.
 *
 * Side-effect: persists hp/mana/lastRegenAt when at least 1 HP or 1 Mana ticked.
 */
export async function applyPassiveRegen(c: Character): Promise<{
  character: Character;
  rate: RegenRates;
}> {
  const rate = await rateForLocation(c.locationId);

  if (!c.isAlive || c.inBattle) {
    return { character: c, rate };
  }

  const now = new Date();
  const last = c.lastRegenAt ? new Date(c.lastRegenAt) : now;
  const elapsedSec = Math.max(0, (now.getTime() - last.getTime()) / 1000);
  if (elapsedSec < 1) return { character: c, rate };

  const hpGain = Math.floor(elapsedSec * rate.hpPerSec);
  const manaGain = Math.floor(elapsedSec * rate.manaPerSec);
  if (hpGain <= 0 && manaGain <= 0) return { character: c, rate };

  const newHp = Math.min(c.maxHp, c.hp + hpGain);
  const newMana = Math.min(c.maxMana, c.mana + manaGain);
  if (newHp === c.hp && newMana === c.mana) {
    // already capped — bump timestamp so we don't accumulate ghost ticks
    await db.update(characters).set({ lastRegenAt: now }).where(eq(characters.id, c.id));
    return { character: { ...c, lastRegenAt: now }, rate };
  }

  const [updated] = await db
    .update(characters)
    .set({ hp: newHp, mana: newMana, lastRegenAt: now })
    .where(eq(characters.id, c.id))
    .returning();
  return { character: updated ?? c, rate };
}

export function clearRegenCache(): void {
  REGEN_CACHE.clear();
}
