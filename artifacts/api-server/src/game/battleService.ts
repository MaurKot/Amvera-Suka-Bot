import { db, battles, characters, worldEvents } from "@workspace/db";
import type { Character, Battle as DBBattle } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getEnemy, getLocation } from "./lore";
import { applyExpAndLevelUp } from "./characterService";
import { getEventConfig } from "./events";

// ─── P7 — Status effects ────────────────────────────────────────────────────
// Effects live inside the battle log as a "status_state" entry that's
// rewritten every round. This avoids a schema migration while remaining
// authoritative — the latest such entry is the source of truth.

export type StatusKind = "bleed" | "poison" | "stun" | "fear";

export interface StatusEffect {
  target: "player" | "enemy";
  kind: StatusKind;
  stacks: number;       // 1+ — bleed/poison damage scales with stacks
  durationLeft: number; // rounds remaining; ticks down each round
}

const STATUS_RU: Record<StatusKind, { name: string; verb: string }> = {
  bleed:  { name: "кровотечение", verb: "истекает кровью" },
  poison: { name: "яд",           verb: "содрогается от яда" },
  stun:   { name: "оглушение",    verb: "оглушён" },
  fear:   { name: "страх",        verb: "охвачен ужасом" },
};

export interface BattleLogEntry {
  round: number;
  actor: "player" | "enemy" | "system";
  action: string;
  text: string;
  damage?: number;
  crit?: boolean;
  effects?: StatusEffect[];   // status effects applied THIS line
  state?: StatusEffect[];     // present only on the synthetic status_state line
}

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function chance(p: number): boolean {
  return Math.random() < p;
}

function readState(log: BattleLogEntry[]): StatusEffect[] {
  for (let i = log.length - 1; i >= 0; i--) {
    if (log[i]!.action === "status_state" && log[i]!.state) return log[i]!.state!;
  }
  return [];
}

function addEffect(state: StatusEffect[], eff: StatusEffect): StatusEffect[] {
  // Stacking: same target+kind → bump stacks (cap 5) and refresh duration.
  const idx = state.findIndex((s) => s.target === eff.target && s.kind === eff.kind);
  if (idx === -1) return [...state, eff];
  const cur = state[idx]!;
  const next = {
    ...cur,
    stacks: Math.min(5, cur.stacks + eff.stacks),
    durationLeft: Math.max(cur.durationLeft, eff.durationLeft),
  };
  return state.map((s, i) => (i === idx ? next : s));
}

function tickEffects(
  state: StatusEffect[],
  side: "player" | "enemy",
): { remaining: StatusEffect[]; dotDamage: number; stunned: boolean; fearMult: number; ticks: BattleLogEntry[] } {
  const ticks: BattleLogEntry[] = [];
  let dotDamage = 0;
  let stunned = false;
  let fearMult = 1;

  const remaining: StatusEffect[] = [];
  for (const e of state) {
    if (e.target !== side) {
      remaining.push(e);
      continue;
    }
    if (e.kind === "bleed") {
      const d = 2 * e.stacks;
      dotDamage += d;
      ticks.push({
        round: 0,
        actor: "system",
        action: "dot_bleed",
        text: `${side === "player" ? "Игрок" : "Враг"} ${STATUS_RU.bleed.verb} (-${d}).`,
        damage: d,
      });
    } else if (e.kind === "poison") {
      const d = 3 * e.stacks;
      dotDamage += d;
      ticks.push({
        round: 0,
        actor: "system",
        action: "dot_poison",
        text: `${side === "player" ? "Игрок" : "Враг"} ${STATUS_RU.poison.verb} (-${d}).`,
        damage: d,
      });
    } else if (e.kind === "stun") {
      stunned = true;
      ticks.push({
        round: 0,
        actor: "system",
        action: "dot_stun",
        text: `${side === "player" ? "Игрок" : "Враг"} ${STATUS_RU.stun.verb} — пропускает ход.`,
      });
    } else if (e.kind === "fear") {
      fearMult = 0.6;
      ticks.push({
        round: 0,
        actor: "system",
        action: "dot_fear",
        text: `${side === "player" ? "Игрок" : "Враг"} ${STATUS_RU.fear.verb} — урон снижен.`,
      });
    }
    const decremented = { ...e, durationLeft: e.durationLeft - 1 };
    if (decremented.durationLeft > 0) remaining.push(decremented);
  }
  return { remaining, dotDamage, stunned, fearMult, ticks };
}

function rollInflict(action: "attack" | "heavy", luck: number, intelligence: number): StatusEffect | null {
  // Heavy attacks have higher inflict chance and richer pool.
  if (action === "attack") {
    if (chance(0.12 + luck * 0.01)) {
      return { target: "enemy", kind: "bleed", stacks: 1, durationLeft: 3 };
    }
  } else if (action === "heavy") {
    const r = Math.random();
    const baseP = 0.30 + luck * 0.01 + intelligence * 0.005;
    if (r < baseP * 0.40) return { target: "enemy", kind: "bleed",  stacks: 2, durationLeft: 3 };
    if (r < baseP * 0.70) return { target: "enemy", kind: "poison", stacks: 1, durationLeft: 4 };
    if (r < baseP * 0.85) return { target: "enemy", kind: "stun",   stacks: 1, durationLeft: 1 };
    if (r < baseP)        return { target: "enemy", kind: "fear",   stacks: 1, durationLeft: 2 };
  }
  return null;
}

function rollEnemyInflict(enemyLevel: number): StatusEffect | null {
  // Tougher enemies inflict more often.
  const baseP = 0.10 + Math.min(0.20, enemyLevel * 0.02);
  const r = Math.random();
  if (r < baseP * 0.45) return { target: "player", kind: "bleed",  stacks: 1, durationLeft: 3 };
  if (r < baseP * 0.75) return { target: "player", kind: "poison", stacks: 1, durationLeft: 3 };
  if (r < baseP * 0.90) return { target: "player", kind: "fear",   stacks: 1, durationLeft: 2 };
  if (r < baseP)        return { target: "player", kind: "stun",   stacks: 1, durationLeft: 1 };
  return null;
}

// Initiative — agility vs enemy speed (level + 4). Higher roll acts first.
function playerActsFirst(c: Character, enemyLevel: number): boolean {
  const playerRoll = c.agility + rand(0, 5);
  const enemyRoll = enemyLevel + 4 + rand(0, 5);
  return playerRoll >= enemyRoll;
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
    {
      round: 0,
      actor: "system",
      action: "status_state",
      text: "",
      state: [],
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
  const lastNumericRound = [...log].reverse().find((l) => l.round > 0)?.round ?? 0;
  const round = lastNumericRound + 1;
  let effectsState = readState(log);

  // ─── FLEE ────────────────────────────────────────────────────────────────
  if (action === "flee") {
    const fearActive = effectsState.some((e) => e.target === "player" && e.kind === "fear");
    const escapeChance = (fearActive ? 0.45 : 0.6) + Math.min(0.3, c.agility * 0.01);
    if (chance(escapeChance)) {
      status = "fled";
      log = [
        ...log,
        { round, actor: "player", action: "flee",
          text: `${c.name} растворяется в тенях, оставляя за собой только эхо шагов.` },
      ];
    } else {
      const dmg = Math.max(1, battle.enemyDamage + rand(-2, 4));
      charHp = Math.max(0, charHp - dmg);
      log = [
        ...log,
        { round, actor: "system", action: "flee_fail",
          text: `Бегство не удалось — ${battle.enemyName} настигает удар.` },
        { round, actor: "enemy",  action: "punish",
          text: `${battle.enemyName} наносит ${dmg} урона вдогонку.`, damage: dmg },
      ];
      if (charHp <= 0) status = "defeat";
    }
  } else {
    // ─── INITIATIVE — who strikes first this round ────────────────────────
    const playerFirst = playerActsFirst(c, battle.enemyLevel);
    log = [
      ...log,
      { round, actor: "system", action: "initiative",
        text: playerFirst
          ? `${c.name} двигается первым (ловкость ${c.agility}).`
          : `${battle.enemyName} опережает тебя.` },
    ];

    // Helper closures
    let manaCost = 0;
    let actionText = "";
    let baseDmg = 0;
    let crit = false;
    let inflicted: StatusEffect | null = null;
    let finisher = false;

    const computePlayerDamage = () => {
      let dmg = c.strength + rand(2, 6);
      if (action === "attack") {
        crit = chance(0.10 + c.luck * 0.01);
        if (crit) dmg = Math.round(dmg * 1.7);
        actionText = `${c.name} наносит удар. ${dmg} урона${crit ? " — критический!" : "."}`;
        inflicted = rollInflict("attack", c.luck, c.intelligence);
      } else if (action === "heavy") {
        manaCost = 8;
        if (c.mana < manaCost) {
          actionText = "";
          return -1;
        }
        dmg = Math.round(dmg * 1.6) + Math.round(c.intelligence * 0.4);
        crit = chance(0.18 + c.luck * 0.01);
        if (crit) dmg = Math.round(dmg * 1.6);
        actionText = `${c.name} вкладывает ярость в удар. ${dmg} урона${crit ? " — критический!" : "."}`;
        inflicted = rollInflict("heavy", c.luck, c.intelligence);
      } else if (action === "defend") {
        actionText = `${c.name} занимает оборону, выжидая.`;
        dmg = 0;
      }
      // Player fear penalty
      const playerFear = effectsState.some((e) => e.target === "player" && e.kind === "fear");
      if (playerFear && dmg > 0) dmg = Math.max(1, Math.round(dmg * 0.6));
      return dmg;
    };

    const performPlayerTurn = (): boolean => {
      // Returns true if combat ends.
      const playerStunned = effectsState.some((e) => e.target === "player" && e.kind === "stun");
      if (playerStunned) {
        log = [
          ...log,
          { round, actor: "player", action: "stunned",
            text: `${c.name} оглушён и не может действовать.` },
        ];
        return false;
      }
      baseDmg = computePlayerDamage();
      if (baseDmg < 0) {
        log = [
          ...log,
          { round, actor: "system", action: "error",
            text: "Не хватает маны для тяжёлого удара." },
        ];
        return false;
      }

      // Finishing blow: enemy at low HP + offensive action
      if (
        (action === "attack" || action === "heavy") &&
        enemyHp - baseDmg <= 0 &&
        enemyHp <= Math.max(8, Math.round(battle.enemyMaxHp * 0.20))
      ) {
        finisher = true;
        baseDmg = enemyHp + 5;
        actionText = `${c.name} наносит добивающий удар — ${battle.enemyName} рушится наземь.`;
      }

      enemyHp = Math.max(0, enemyHp - baseDmg);
      const entry: BattleLogEntry = {
        round, actor: "player", action: finisher ? "finisher" : action,
        text: actionText,
        damage: baseDmg > 0 ? baseDmg : undefined,
        crit: crit || undefined,
      };
      if (inflicted) {
        effectsState = addEffect(effectsState, inflicted);
        entry.effects = [inflicted];
        entry.text += ` Враг — ${STATUS_RU[inflicted.kind].name}.`;
      }
      log = [...log, entry];
      if (enemyHp <= 0) {
        status = "victory";
        return true;
      }
      return false;
    };

    const performEnemyTurn = (): boolean => {
      const enemyStunned = effectsState.some((e) => e.target === "enemy" && e.kind === "stun");
      if (enemyStunned) {
        log = [
          ...log,
          { round, actor: "enemy", action: "stunned",
            text: `${battle.enemyName} оглушён и не атакует.` },
        ];
        return false;
      }
      let enemyDmg = battle.enemyDamage + rand(-1, 3);
      if (action === "defend") enemyDmg = Math.max(1, Math.round(enemyDmg * 0.4));
      const enemyFear = effectsState.some((e) => e.target === "enemy" && e.kind === "fear");
      if (enemyFear) enemyDmg = Math.max(1, Math.round(enemyDmg * 0.6));
      enemyDmg = Math.max(0, enemyDmg - Math.floor(c.endurance / 4));
      charHp = Math.max(0, charHp - enemyDmg);

      const enemyInflicted = rollEnemyInflict(battle.enemyLevel);
      const entry: BattleLogEntry = {
        round, actor: "enemy", action: "attack",
        text: `${battle.enemyName} атакует. ${enemyDmg} урона.`,
        damage: enemyDmg,
      };
      if (enemyInflicted) {
        effectsState = addEffect(effectsState, enemyInflicted);
        entry.effects = [enemyInflicted];
        entry.text += ` Ты — ${STATUS_RU[enemyInflicted.kind].name}.`;
      }
      log = [...log, entry];
      if (charHp <= 0) {
        status = "defeat";
        return true;
      }
      return false;
    };

    // ─── DOT TICKS at start of round ───────────────────────────────────────
    const playerTick = tickEffects(effectsState, "player");
    if (playerTick.dotDamage > 0) {
      charHp = Math.max(0, charHp - playerTick.dotDamage);
    }
    log = [...log, ...playerTick.ticks.map((t) => ({ ...t, round }))];
    if (charHp <= 0) {
      status = "defeat";
    }
    const enemyTick = tickEffects(playerTick.remaining, "enemy");
    if (enemyTick.dotDamage > 0) {
      enemyHp = Math.max(0, enemyHp - enemyTick.dotDamage);
    }
    log = [...log, ...enemyTick.ticks.map((t) => ({ ...t, round }))];
    if (enemyHp <= 0 && status === "active") {
      status = "victory";
      log = [
        ...log,
        { round, actor: "system", action: "dot_kill",
          text: `${battle.enemyName} падает от кровавых ран.` },
      ];
    }
    effectsState = enemyTick.remaining;

    if (status === "active") {
      if (playerFirst) {
        const ended = performPlayerTurn();
        if (!ended) performEnemyTurn();
      } else {
        const ended = performEnemyTurn();
        if (!ended) performPlayerTurn();
      }
    }

    // Apply mana cost
    if (manaCost > 0) {
      await db
        .update(characters)
        .set({ mana: Math.max(0, c.mana - manaCost) })
        .where(eq(characters.id, c.id));
    }
  }

  // Persist updated status_state at end of every action
  log = [
    ...log,
    { round, actor: "system", action: "status_state", text: "", state: effectsState },
  ];

  // Persist battle row
  const updated = await db
    .update(battles)
    .set({ enemyHp, characterHp: charHp, log, status })
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
        { round: round + 1, actor: "system", action: "victory",
          text: `Победа. ${battle.enemyName} повержен. Награда: ${silverGain} серебра и ${exp} опыта.` },
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
        { round: round + 1, actor: "system", action: "defeat",
          text: `Тьма. ${c.name} приходит в себя на площади Ардвейла, едва живой.` },
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
        { round: round + 1, actor: "system", action: "fled",
          text: `${c.name} избегает боя.` },
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
