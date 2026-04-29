import { db, characters } from "@workspace/db";
import type { Character } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getRace, getCharClass } from "./lore";

export function nextLevelExp(level: number): number {
  return Math.round(100 * Math.pow(level, 1.6));
}

export function maxHpFor(charClass: string, race: string, endurance: number, level: number): number {
  const r = getRace(race);
  const base = 80 + (r?.bonuses["hp"] ?? 0);
  const fromEnd = endurance * 5;
  const fromLvl = (level - 1) * 12;
  const classBonus = charClass === "echo_warden" ? 30 : charClass === "echo_blade" ? 20 : 0;
  return Math.max(20, base + fromEnd + fromLvl + classBonus);
}

export function maxManaFor(charClass: string, race: string, intelligence: number, level: number): number {
  const r = getRace(race);
  const base = 30 + (r?.bonuses["mana"] ?? 0);
  const fromInt = intelligence * 4;
  const fromLvl = (level - 1) * 6;
  const classBonus = charClass === "rune_weaver" ? 40 : charClass === "echo_warden" ? 15 : 0;
  return Math.max(10, base + fromInt + fromLvl + classBonus);
}

export async function getCurrentCharacter(sessionId: string): Promise<Character | null> {
  const rows = await db.select().from(characters).where(eq(characters.sessionId, sessionId)).limit(1);
  return rows[0] ?? null;
}

export async function createCharacter(
  sessionId: string,
  name: string,
  race: string,
  charClass: string,
): Promise<Character> {
  const r = getRace(race);
  const c = getCharClass(charClass);
  if (!r) throw new Error(`Неизвестная раса: ${race}`);
  if (!c) throw new Error(`Неизвестный класс: ${charClass}`);

  const strength = (c.startStats["strength"] ?? 10) + (r.bonuses["strength"] ?? 0);
  const agility = (c.startStats["agility"] ?? 10) + (r.bonuses["agility"] ?? 0);
  const intelligence = (c.startStats["intelligence"] ?? 10) + (r.bonuses["intelligence"] ?? 0);
  const endurance = (c.startStats["endurance"] ?? 10) + (r.bonuses["endurance"] ?? 0);
  const intuition = 10;

  const maxHp = maxHpFor(charClass, race, endurance, 1);
  const maxMana = maxManaFor(charClass, race, intelligence, 1);

  const silver = 50 + (r.bonuses["silver_start"] ?? 0);

  const inserted = await db
    .insert(characters)
    .values({
      sessionId,
      name,
      race,
      charClass,
      level: 1,
      experience: 0,
      hp: maxHp,
      maxHp,
      mana: maxMana,
      maxMana,
      energy: 3,
      maxEnergy: 3,
      strength,
      agility,
      intelligence,
      endurance,
      intuition,
      luck: 1.0,
      statPoints: 0,
      influencePoints: 0,
      silver,
      locationId: "ardvale_square",
      inBattle: false,
      isAlive: true,
      totalKills: 0,
      totalDeaths: 0,
    })
    .returning();
  return inserted[0]!;
}

export function recomputeDerived(c: Character): {
  maxHp: number;
  maxMana: number;
} {
  return {
    maxHp: maxHpFor(c.charClass, c.race, c.endurance, c.level),
    maxMana: maxManaFor(c.charClass, c.race, c.intelligence, c.level),
  };
}

export function applyExpAndLevelUp(c: Character, gainedExp: number): Partial<Character> {
  let exp = c.experience + gainedExp;
  let level = c.level;
  let statPoints = c.statPoints;
  let influencePoints = c.influencePoints;
  while (exp >= nextLevelExp(level)) {
    exp -= nextLevelExp(level);
    level += 1;
    statPoints += 3;
    influencePoints += 1;
  }
  const next = { ...c, experience: exp, level, statPoints, influencePoints };
  const derived = recomputeDerived(next);
  return {
    experience: exp,
    level,
    statPoints,
    influencePoints,
    maxHp: derived.maxHp,
    maxMana: derived.maxMana,
    hp: Math.min(derived.maxHp, c.hp + (level - c.level) * 20),
  };
}
