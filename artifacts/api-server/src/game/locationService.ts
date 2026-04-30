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
import { generateAdjacentLocation } from "./locationGenerator";

const FIRST_DISCOVERER_KEY = "first_discoverer";

export interface AutoDiscoveredPath {
  locationId: string;
  locationName: string;
  region: string;
  description: string;
}

export interface VisitResult {
  location: typeof locations.$inferSelect;
  isFirstDiscoverer: boolean;
  buffActive: boolean;
  buffExpiresAt: Date | null;
  achievementsAwarded: string[];
  /** P7 — when stepping onto a frontier location, the player may auto-discover
   * a brand-new path. Triggered by formula: chance = (luck/maxLuck) * directive
   * * (playerLevel/zoneCap). */
  discoveredNewPath: AutoDiscoveredPath | null;
}

/**
 * Move character to a new location.
 * - Enforces graph connectivity: target must be in current location's `connectedTo`.
 * - Creates discovery record + first-discoverer achievement (with expiring buff) if no one has been there yet.
 * - Emits world+location realtime events for cross-player sync.
 *
 * Returns null on missing location/character. Throws `Error("not_connected")`
 * if the target is not adjacent to the current location — caller maps to 400.
 */
export class LocationNotConnectedError extends Error {
  constructor(public from: string, public to: string) {
    super(`Location ${to} is not reachable from ${from}`);
  }
}

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

  // Enforce graph connectivity (P2). Same-location is always allowed.
  if (previousLocationId !== locationId) {
    const [prev] = await db
      .select()
      .from(locations)
      .where(eq(locations.id, previousLocationId))
      .limit(1);
    const neighbors = (prev?.connectedTo as string[] | null) ?? [];
    if (!neighbors.includes(locationId)) {
      throw new LocationNotConnectedError(previousLocationId, locationId);
    }
  }

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

  // ── P7 — Frontier auto-discovery ──────────────────────────────────────
  // Replaces the old "Шагнуть за горизонт" button. Whenever a player visits a
  // frontier location, we roll for a procedural new neighbour using the formula
  //   chance = (luck/MAX_LUCK) * masterAiDirective * (playerLevel/zoneCap)
  let discoveredNewPath: AutoDiscoveredPath | null = null;
  const MAX_LUCK = 5;
  const ZONE_CAP_FOR = (lvl: number) => Math.max(1, lvl); // dynamic zone cap from directive
  if (loc.isFrontier && previousLocationId !== locationId) {
    const masterAiDirective = 0.25; // base discovery weight; tuned per-region by world director
    const luckTerm = Math.min(1, c.luck / MAX_LUCK);
    const zoneCap = ZONE_CAP_FOR(Math.max(c.level, 1));
    const levelTerm = Math.min(1, c.level / Math.max(1, zoneCap + 2));
    const chance = Math.min(0.6, luckTerm * masterAiDirective * (1 + levelTerm));

    if (Math.random() < chance) {
      try {
        const result = await generateAdjacentLocation({
          parentId: locationId,
          log,
          triggeredBy: "auto_discovery",
        });
        if (result) {
          discoveredNewPath = {
            locationId: result.location.id,
            locationName: result.location.name,
            region: result.location.region,
            description: result.location.description,
          };
          log.info(
            { from: locationId, to: result.location.id, by: c.name, chance },
            "Auto-discovery: new path revealed",
          );
        }
      } catch (err) {
        log.warn({ err: (err as Error).message, from: locationId }, "Auto-discovery roll failed");
      }
    }
  }

  return {
    location: { ...loc, discoveredById: isFirst ? characterId : loc.discoveredById, discoveredByName: isFirst ? c.name : loc.discoveredByName, discoveredAt: isFirst ? new Date() : loc.discoveredAt },
    isFirstDiscoverer: isFirst,
    buffActive: isFirst,
    buffExpiresAt,
    achievementsAwarded: awarded,
    discoveredNewPath,
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
