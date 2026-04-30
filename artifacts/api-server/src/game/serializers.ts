import type { Character, Battle as DBBattle, InventoryItem, WorldEvent } from "@workspace/db";
import { nextLevelExp } from "./characterService";

export function serializeCharacter(c: Character) {
  return {
    id: c.id,
    name: c.name,
    race: c.race,
    charClass: c.charClass,
    level: c.level,
    experience: c.experience,
    nextLevelExp: nextLevelExp(c.level),
    hp: c.hp,
    maxHp: c.maxHp,
    mana: c.mana,
    maxMana: c.maxMana,
    energy: c.energy,
    maxEnergy: c.maxEnergy,
    strength: c.strength,
    agility: c.agility,
    intelligence: c.intelligence,
    endurance: c.endurance,
    intuition: c.intuition,
    luck: c.luck,
    statPoints: c.statPoints,
    influencePoints: c.influencePoints,
    silver: c.silver,
    locationId: c.locationId,
    inBattle: c.inBattle,
    isAlive: c.isAlive,
    totalKills: c.totalKills,
    totalDeaths: c.totalDeaths,
    lastRegenAt: c.lastRegenAt?.toISOString?.() ?? null,
  };
}

export function serializeBattle(b: DBBattle) {
  return {
    id: b.id,
    characterId: b.characterId,
    enemyKey: b.enemyKey,
    enemyName: b.enemyName,
    enemyLevel: b.enemyLevel,
    enemyHp: b.enemyHp,
    enemyMaxHp: b.enemyMaxHp,
    characterHp: b.characterHp,
    status: b.status as "active" | "victory" | "defeat" | "fled",
    log: (b.log as unknown as Array<{
      round: number;
      actor: "player" | "enemy" | "system";
      action: string;
      text: string;
      damage?: number;
      crit?: boolean;
    }>) ?? [],
    rewardSilver: b.rewardSilver,
    rewardExp: b.rewardExp,
  };
}

export function serializeInventoryItem(i: InventoryItem) {
  return {
    id: i.id,
    itemKey: i.itemKey,
    name: i.name,
    itemType: i.itemType,
    rarity: i.rarity,
    quantity: i.quantity,
    equipped: i.equipped,
    stats: (i.stats as Record<string, unknown>) ?? {},
  };
}

export function serializeLedger(e: WorldEvent) {
  return {
    id: e.id,
    eventType: e.eventType,
    targetId: e.targetId,
    locationId: e.locationId,
    description: e.description,
    deltaRep: e.deltaRep,
    severity: e.severity,
    isPublic: e.isPublic,
    createdAt: e.createdAt.toISOString(),
  };
}
