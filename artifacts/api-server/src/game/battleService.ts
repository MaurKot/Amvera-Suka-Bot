import { db, battles, characters, worldEvents } from "@workspace/db";
import type { Character, Battle as DBBattle } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getEnemy, getLocation } from "./lore";
import { applyExpAndLevelUp } from "./characterService";
import { getEventConfig } from "./events";

export interface BattleLogEntry {
  round: number;
  actor: "player" | "enemy" | "system";
  action: string;
  text: string;
  damage?: number;
  crit?: boolean;
}

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function chance(p: number): boolean {
  return Math.random() < p;
}

export async function getActiveBattleFor(characterId: number): Promise<DBBattle | null> {
  const rows = await db
    .select()
    .from(battles)
    .where(eq(battles.characterId, characterId))
    .orderBy(battles.id);
  return rows.find((b) => b.status === "active") ?? null;
}

export async function startBattle(
  c: Character,
  enemyKey: string,
): Promise<{ battle: DBBattle; character: Character }> {
  const tpl = getEnemy(enemyKey);
  if (!tpl) throw new Error("Враг не найден");
  if (tpl.locationId !== c.locationId) {
    const loc = getLocation(tpl.locationId);
    throw new Error(`Этого врага можно встретить в локации «${loc?.name ?? tpl.locationId}»`);
  }
  const initialLog: BattleLogEntry[] = [
    {
      round: 0,
      actor: "system",
      action: "encounter",
      text: `Перед тобой встаёт ${tpl.name}. ${tpl.lore}`,
    },
  ];
  const inserted = await db
    .insert(battles)
    .values({
      characterId: c.id,
      enemyKey: tpl.key,
      enemyName: tpl.name,
      enemyLevel: tpl.level,
      enemyHp: tpl.hp,
      enemyMaxHp: tpl.hp,
      enemyDamage: tpl.damage,
      characterHp: c.hp,
      log: initialLog,
      status: "active",
      rewardSilver: tpl.rewardSilver,
      rewardExp: tpl.rewardExp,
    })
    .returning();
  const updatedChar = await db
    .update(characters)
    .set({ inBattle: true })
    .where(eq(characters.id, c.id))
    .returning();
  return { battle: inserted[0]!, character: updatedChar[0]! };
}

export interface ActionResult {
  battle: DBBattle;
  character: Character;
}

export async function performAction(
  c: Character,
  action: "attack" | "heavy" | "defend" | "flee",
): Promise<ActionResult> {
  const battle = await getActiveBattleFor(c.id);
  if (!battle) throw new Error("Активного боя нет");

  let log = (battle.log as unknown as BattleLogEntry[]) ?? [];
  let enemyHp = battle.enemyHp;
  let charHp = battle.characterHp;
  let status: DBBattle["status"] = "active";
  const round = (log[log.length - 1]?.round ?? 0) + 1;

  // FLEE
  if (action === "flee") {
    const escapeChance = 0.6 + Math.min(0.3, c.agility * 0.01);
    if (chance(escapeChance)) {
      status = "fled";
      log = [
        ...log,
        {
          round,
          actor: "player",
          action: "flee",
          text: `${c.name} растворяется в тенях, оставляя за собой только эхо шагов.`,
        },
      ];
    } else {
      const dmg = Math.max(1, battle.enemyDamage + rand(-2, 4));
      charHp = Math.max(0, charHp - dmg);
      log = [
        ...log,
        {
          round,
          actor: "system",
          action: "flee_fail",
          text: `Бегство не удалось — ${battle.enemyName} настигает удар.`,
        },
        {
          round,
          actor: "enemy",
          action: "punish",
          text: `${battle.enemyName} наносит ${dmg} урона вдогонку.`,
          damage: dmg,
        },
      ];
      if (charHp <= 0) {
        status = "defeat";
      }
    }
  } else {
    // PLAYER ACTION
    let baseDmg = c.strength + rand(2, 6);
    let crit = false;
    let manaCost = 0;
    let actionText = "";

    if (action === "attack") {
      crit = chance(0.10 + c.luck * 0.01);
      if (crit) baseDmg = Math.round(baseDmg * 1.7);
      actionText = `${c.name} наносит удар. ${baseDmg} урона${crit ? " — критический!" : "."}`;
    } else if (action === "heavy") {
      manaCost = 8;
      if (c.mana < manaCost) {
        return await persistError(battle, log, round, "Не хватает маны для тяжёлого удара");
      }
      baseDmg = Math.round(baseDmg * 1.6) + Math.round(c.intelligence * 0.4);
      crit = chance(0.18 + c.luck * 0.01);
      if (crit) baseDmg = Math.round(baseDmg * 1.6);
      actionText = `${c.name} вкладывает ярость в удар. ${baseDmg} урона${crit ? " — критический!" : "."}`;
    } else if (action === "defend") {
      actionText = `${c.name} занимает оборону, выжидая.`;
      baseDmg = 0;
    }

    enemyHp = Math.max(0, enemyHp - baseDmg);
    log = [
      ...log,
      {
        round,
        actor: "player",
        action,
        text: actionText,
        damage: baseDmg > 0 ? baseDmg : undefined,
        crit: crit || undefined,
      },
    ];

    if (enemyHp <= 0) {
      status = "victory";
    } else {
      // ENEMY TURN
      let enemyDmg = battle.enemyDamage + rand(-1, 3);
      if (action === "defend") enemyDmg = Math.max(1, Math.round(enemyDmg * 0.4));
      enemyDmg = Math.max(0, enemyDmg - Math.floor(c.endurance / 4));
      charHp = Math.max(0, charHp - enemyDmg);
      log = [
        ...log,
        {
          round,
          actor: "enemy",
          action: "attack",
          text: `${battle.enemyName} атакует. ${enemyDmg} урона.`,
          damage: enemyDmg,
        },
      ];
      if (charHp <= 0) status = "defeat";
    }

    // Apply mana cost
    if (manaCost > 0) {
      await db
        .update(characters)
        .set({ mana: Math.max(0, c.mana - manaCost) })
        .where(eq(characters.id, c.id));
    }
  }

  // Persist
  const updated = await db
    .update(battles)
    .set({
      enemyHp,
      characterHp: charHp,
      log,
      status,
    })
    .where(eq(battles.id, battle.id))
    .returning();

  let updatedChar = c;

  if (status !== "active") {
    const updates: Partial<Character> = {
      inBattle: false,
      hp: Math.max(0, charHp),
    };
    if (status === "victory") {
      const exp = battle.rewardExp;
      const silverGain = battle.rewardSilver;
      const lvlChanges = applyExpAndLevelUp(c, exp);
      Object.assign(updates, lvlChanges);
      updates.silver = c.silver + silverGain;
      updates.totalKills = c.totalKills + 1;
      log = [
        ...log,
        {
          round: round + 1,
          actor: "system",
          action: "victory",
          text: `Победа. ${battle.enemyName} повержен. Награда: ${silverGain} серебра и ${exp} опыта.`,
        },
      ];
      const ev = getEventConfig("defeated_enemy");
      await db.insert(worldEvents).values({
        eventType: "defeated_enemy",
        actorId: c.id,
        targetId: battle.enemyKey,
        locationId: c.locationId,
        deltaRep: ev.rep,
        narrativeFlag: "defeated_enemy",
        severity: ev.sev,
        isPublic: ev.public,
        description: `Победил противника: ${battle.enemyName}`,
      });
    } else if (status === "defeat") {
      updates.totalDeaths = c.totalDeaths + 1;
      updates.hp = Math.max(1, Math.floor(c.maxHp * 0.2));
      updates.locationId = "ardvale_square";
      log = [
        ...log,
        {
          round: round + 1,
          actor: "system",
          action: "defeat",
          text: `Тьма. ${c.name} приходит в себя на площади Ардвейла, едва живой.`,
        },
      ];
      const ev = getEventConfig("fell_in_battle");
      await db.insert(worldEvents).values({
        eventType: "fell_in_battle",
        actorId: c.id,
        targetId: battle.enemyKey,
        locationId: c.locationId,
        deltaRep: ev.rep,
        narrativeFlag: "fell_in_battle",
        severity: ev.sev,
        isPublic: ev.public,
        description: `Пал в бою с ${battle.enemyName}`,
      });
    } else if (status === "fled") {
      log = [
        ...log,
        {
          round: round + 1,
          actor: "system",
          action: "fled",
          text: `${c.name} избегает боя.`,
        },
      ];
      const ev = getEventConfig("fled_from_battle");
      await db.insert(worldEvents).values({
        eventType: "fled_from_battle",
        actorId: c.id,
        targetId: battle.enemyKey,
        locationId: c.locationId,
        deltaRep: ev.rep,
        narrativeFlag: "fled_from_battle",
        severity: ev.sev,
        isPublic: ev.public,
        description: `Бежал от ${battle.enemyName}`,
      });
    }

    // re-save log with system message appended
    await db.update(battles).set({ log }).where(eq(battles.id, battle.id));

    const ucRows = await db
      .update(characters)
      .set(updates)
      .where(eq(characters.id, c.id))
      .returning();
    updatedChar = ucRows[0]!;
  } else {
    const ucRows = await db
      .update(characters)
      .set({ hp: charHp })
      .where(eq(characters.id, c.id))
      .returning();
    updatedChar = ucRows[0]!;
  }

  return { battle: { ...updated[0]!, log }, character: updatedChar };
}

async function persistError(
  battle: DBBattle,
  log: BattleLogEntry[],
  round: number,
  message: string,
): Promise<ActionResult> {
  const updatedLog = [
    ...log,
    { round, actor: "system" as const, action: "error", text: message },
  ];
  await db.update(battles).set({ log: updatedLog }).where(eq(battles.id, battle.id));
  const c = await db
    .select()
    .from(characters)
    .where(eq(characters.id, battle.characterId))
    .limit(1);
  return { battle: { ...battle, log: updatedLog }, character: c[0]! };
}
