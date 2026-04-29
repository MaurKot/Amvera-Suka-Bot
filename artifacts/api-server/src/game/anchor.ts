import { db, locations, npcs as npcsT, worldEvents, characters } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import { LOCATIONS, ENEMIES } from "./lore";

export interface ContextAnchor {
  knownLocationIds: Set<string>;
  knownLocations: { id: string; name: string }[];
  knownNpcIds: Set<string>;
  knownNpcs: { id: string; name: string; locationId: string }[];
  knownEnemyKeys: Set<string>;
  knownEnemies: { key: string; name: string }[];
  recentLocationEvents: { description: string; createdAt: Date }[];
  currentLocation: { id: string; name: string; region: string; description: string } | null;
  characterName: string;
}

export async function buildContextAnchor(characterId: number): Promise<ContextAnchor> {
  const [character] = await db
    .select()
    .from(characters)
    .where(eq(characters.id, characterId))
    .limit(1);

  if (!character) throw new Error("character not found");

  const allLocations = await db.select().from(locations);
  const knownLocs = allLocations.length > 0
    ? allLocations.map((l) => ({ id: l.id, name: l.name, region: l.region, description: l.description }))
    : LOCATIONS.map((l) => ({ id: l.id, name: l.name, region: l.region, description: l.description }));

  const allNpcs = await db.select().from(npcsT);
  const recentEvents = await db
    .select()
    .from(worldEvents)
    .where(and(eq(worldEvents.locationId, character.locationId), eq(worldEvents.isPublic, true)))
    .orderBy(desc(worldEvents.createdAt))
    .limit(8);

  const currentLoc = knownLocs.find((l) => l.id === character.locationId) ?? null;

  return {
    knownLocationIds: new Set(knownLocs.map((l) => l.id)),
    knownLocations: knownLocs.map((l) => ({ id: l.id, name: l.name })),
    knownNpcIds: new Set(allNpcs.map((n) => n.id)),
    knownNpcs: allNpcs.map((n) => ({ id: n.id, name: n.name, locationId: n.locationId })),
    knownEnemyKeys: new Set(ENEMIES.map((e) => e.key)),
    knownEnemies: ENEMIES.map((e) => ({ key: e.key, name: e.name })),
    recentLocationEvents: recentEvents.map((e) => ({
      description: e.description,
      createdAt: e.createdAt,
    })),
    currentLocation: currentLoc,
    characterName: character.name,
  };
}

/**
 * Render a compact anchor block embeddable in a Gemini system prompt.
 * Tells the model what facts about the world it is allowed to reference.
 */
export function renderAnchorForPrompt(anchor: ContextAnchor): string {
  const lines: string[] = [];
  lines.push("ЯКОРЬ МИРА (используй ТОЛЬКО эти факты, не выдумывай новые места и людей):");
  if (anchor.currentLocation) {
    lines.push(
      `• Текущее место: ${anchor.currentLocation.name} (${anchor.currentLocation.region}). ${anchor.currentLocation.description}`,
    );
  }
  if (anchor.knownLocations.length > 0) {
    lines.push(
      `• Известные места: ${anchor.knownLocations
        .slice(0, 12)
        .map((l) => l.name)
        .join(", ")}.`,
    );
  }
  const npcsHere = anchor.knownNpcs.filter(
    (n) => n.locationId === anchor.currentLocation?.id,
  );
  if (npcsHere.length > 0) {
    lines.push(
      `• Здесь же сейчас: ${npcsHere.map((n) => n.name).join(", ")}.`,
    );
  }
  if (anchor.recentLocationEvents.length > 0) {
    lines.push(
      `• Свежие события в этом месте: ${anchor.recentLocationEvents
        .slice(0, 4)
        .map((e) => e.description)
        .join("; ")}.`,
    );
  }
  return lines.join("\n");
}
