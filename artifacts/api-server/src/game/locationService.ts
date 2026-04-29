import {
  db,
  locations,
  characterAchievements,
  achievements,
  characters,
  worldEvents,
} from "@workspace/db";
import { and, eq, gt, isNull, or } from "drizzle-orm";
import { publishEvent } from "../lib/realtime";
import type { Logger } from "pino";

const FIRST_DISCOVERER_KEY = "first_discoverer";

export interface VisitResult {
  location: typeof locations.$inferSelect;
  isFirstDiscoverer: boolean;
  buffActive: boolean;
  buffExpiresAt: Date | null;
  achievementsAwarded: string[];
}

/**
 * Move character to a new location.
 * - Creates discovery record + first-discoverer achievement (with expiring buff) if no one has been there yet.
 * - Emits world+location realtime events for cross-player sync.
 */
export async function visitLocation(
  characterId: number,
  locationId: string,
  log: Logger,
): Promise<VisitResult | null> {
  const [loc] = await db.select().from(locations).where(eq(locations.id, locationId)).limit(1);
  if (!loc) return null;

  const [c] = await db.select().from(characters).where(eq(characters.id, characterId)).limit(1);
  if (!c) return null;

  const previousLocationId = c.locationId;

  await db
    .update(characters)
    .set({ locationId })
    .where(eq(characters.id, characterId));

  let isFirst = false;
  const awarded: string[] = [];
  let buffExpiresAt: Date | null = null;

  if (!loc.discoveredById) {
    // Race-safe single-shot claim: only the first writer wins thanks to the WHERE clause.
    const claim = await db
      .update(locations)
      .set({
        discoveredById: characterId,
        discoveredByName: c.name,
        discoveredAt: new Date(),
      })
      .where(and(eq(locations.id, locationId), isNull(locations.discoveredById)))
      .returning({ id: locations.id });

    if (claim.length > 0) {
      isFirst = true;
      const [achievement] = await db
        .select()
        .from(achievements)
        .where(eq(achievements.key, FIRST_DISCOVERER_KEY))
        .limit(1);
      const durationSec = achievement?.buffDurationSec ?? 60 * 60 * 6;
      buffExpiresAt = new Date(Date.now() + durationSec * 1000);

      await db
        .insert(characterAchievements)
        .values({
          characterId,
          achievementKey: FIRST_DISCOVERER_KEY,
          targetId: locationId,
          earnedAt: new Date(),
          expiresAt: buffExpiresAt,
        })
        .onConflictDoNothing();
      awarded.push(FIRST_DISCOVERER_KEY);

      await db.insert(worldEvents).values({
        eventType: "location_discovered",
        actorId: characterId,
        targetId: locationId,
        locationId,
        deltaRep: 0,
        narrativeFlag: "first_discoverer",
        severity: 2,
        isPublic: true,
        description: `${c.name} впервые ступил(а) в место «${loc.name}».`,
      });

      await publishEvent({
        channel: "world",
        type: "location_discovered",
        scope: locationId,
        payload: {
          locationId,
          locationName: loc.name,
          discovererId: characterId,
          discovererName: c.name,
        },
      });
      log.info({ locationId, by: c.name }, "First discoverer claimed");
    }
  }

  // Emit movement events for cross-player presence sync (Postgres-backed realtime)
  await publishEvent({
    channel: "location",
    type: "character_left",
    scope: previousLocationId,
    payload: { characterId, characterName: c.name, locationId: previousLocationId },
  });
  await publishEvent({
    channel: "location",
    type: "character_entered",
    scope: locationId,
    payload: { characterId, characterName: c.name, locationId },
  });

  return {
    location: { ...loc, discoveredById: isFirst ? characterId : loc.discoveredById, discoveredByName: isFirst ? c.name : loc.discoveredByName, discoveredAt: isFirst ? new Date() : loc.discoveredAt },
    isFirstDiscoverer: isFirst,
    buffActive: isFirst,
    buffExpiresAt,
    achievementsAwarded: awarded,
  };
}

/** Get currently active first-discoverer buffs for a character. */
export async function getActiveBuffs(characterId: number) {
  const now = new Date();
  return db
    .select()
    .from(characterAchievements)
    .where(
      and(
        eq(characterAchievements.characterId, characterId),
        or(isNull(characterAchievements.expiresAt), gt(characterAchievements.expiresAt, now)),
      ),
    );
}
