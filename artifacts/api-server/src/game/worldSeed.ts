import {
  db,
  locations,
  factions,
  quests,
  achievements,
  bestiary,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { LOCATIONS, ENEMIES } from "./lore";
import type { Logger } from "pino";

const FACTION_SEED = [
  { key: "ardvale_council", name: "Совет Ардвейла", description: "Хранители памяти и закона старого города.", defaultRep: 0, isHostile: false },
  { key: "ardvale_watch", name: "Стража Ардвейла", description: "Чёрные кольчуги, которые держат порядок.", defaultRep: 0, isHostile: false },
  { key: "maeran_caravan", name: "Маэранский Караван", description: "Торговцы, для которых золото открывает любые двери.", defaultRep: 0, isHostile: false },
  { key: "broken_faith", name: "Сломленная Вера", description: "Те, кто остался у молчащих алтарей.", defaultRep: 0, isHostile: false },
  { key: "thornwood_kin", name: "Род Торнвуд", description: "Лесные охотники, чтящие духов природы.", defaultRep: 0, isHostile: false },
  { key: "sahvaki_circle", name: "Круг Сахваки", description: "Двулунные провидцы, читающие тени.", defaultRep: 0, isHostile: false },
  { key: "karath_clan", name: "Клан Карат", description: "Горные кузнецы, поклоняющиеся камню.", defaultRep: 0, isHostile: false },
  { key: "ash_marauders", name: "Пепельные Мародёры", description: "Разбойники Каменного Клыка. Видят в чужаке добычу.", defaultRep: -250, isHostile: true },
  { key: "swamp_thralls", name: "Болотные Невольники", description: "Утопленные, что помнят, кто их утопил. Враждебны ко всем живым.", defaultRep: -200, isHostile: true },
  { key: "neutral", name: "Без фракции", description: "Одиночки и странники.", defaultRep: 0, isHostile: false },
];

const QUEST_SEED = [
  {
    id: "ardvale_first_steps",
    title: "Свечи Ардвейла",
    description:
      "Старейшина Рован просит зажечь свечи памяти на площади Ардвейла. Простое дело для прибывшего — и первое имя в его хрониках.",
    type: "general",
    giverId: "elder_rovan",
    locationId: "ardvale_square",
    objectives: [
      { key: "talk_to_rovan", text: "Поговори со Старейшиной Рованом", target: "elder_rovan" },
      { key: "visit_chapel", text: "Посети Сломленную Часовню", target: "broken_chapel" },
    ],
    rewards: { silver: 30, exp: 40, reputation: { ardvale_council: 25 } },
    isStarter: true,
  },
  {
    id: "salt_market_introduction",
    title: "Соляной Кивок",
    description:
      "Холвас уверяет, что в каждой беседе на Соляном Рынке кроется выгода. Поговори с ним и хозяйкой Маирой — и пойми, чьей памяти стоит доверять больше.",
    type: "general",
    giverId: "merchant_holvas",
    locationId: "salt_market",
    objectives: [
      { key: "talk_to_holvas", text: "Поговори с Холвасом", target: "merchant_holvas" },
      { key: "talk_to_maira", text: "Поговори с хозяйкой Маирой", target: "tavernkeep_maira" },
    ],
    rewards: { silver: 40, exp: 50, reputation: { maeran_caravan: 20 } },
    isStarter: true,
  },
  {
    id: "ash_woods_first_hunt",
    title: "След Пепельного Волка",
    description:
      "Каэрн уверен: волки снова рыщут у тропы. Ступи в Пепельный Лес и проверь — слово охотника или собственный шрам.",
    type: "general",
    giverId: "hunter_kaern",
    locationId: "ash_woods",
    objectives: [
      { key: "talk_to_kaern", text: "Поговори с Каэрном", target: "hunter_kaern" },
      { key: "kill_ash_wolf", text: "Победи Пепельного волка", target: "ash_wolf", count: 1 },
    ],
    rewards: { silver: 50, exp: 80, reputation: { thornwood_kin: 20 } },
    isStarter: true,
  },
  {
    id: "moonwell_omen",
    title: "Намерение в Колодце",
    description:
      "Оракул Лещ зовёт всякого, кто ещё не определился. Лощина Лунного Колодца покажет твоё намерение раньше, чем ты сам его поймёшь.",
    type: "general",
    giverId: "shade_oracle",
    locationId: "moonwell_hollow",
    objectives: [
      { key: "visit_moonwell", text: "Посети Лощину Лунного Колодца", target: "moonwell_hollow" },
      { key: "speak_oracle", text: "Поговори с Оракулом Лещ", target: "shade_oracle" },
    ],
    rewards: { silver: 25, exp: 60, reputation: { sahvaki_circle: 30 } },
    isStarter: true,
  },
  {
    id: "stonefang_passage",
    title: "Песня Перевала",
    description:
      "Дурран принимает только тех, кто прошёл перевал и услышал имена. Сильвар покажет тропу — если согласится.",
    type: "general",
    giverId: "smith_durran",
    locationId: "stonefang_pass",
    objectives: [
      { key: "visit_stonefang", text: "Посети Перевал Каменного Клыка", target: "stonefang_pass" },
      { key: "talk_silvar", text: "Поговори с Сильваром", target: "ranger_silvar" },
      { key: "talk_durran", text: "Поговори с Дурраном", target: "smith_durran" },
    ],
    rewards: { silver: 70, exp: 110, reputation: { karath_clan: 25 } },
    isStarter: true,
  },
];

const ACHIEVEMENT_SEED = [
  {
    key: "first_discoverer",
    title: "Первопроходец",
    description:
      "Первым ступил в это место. Жители видят в тебе предвестника — у тебя есть короткое преимущество, пока место помнит твоё имя.",
    icon: "compass",
    buffJson: { type: "discover_aura", reputationBoost: 5, dropChanceBonus: 0.15 },
    buffDurationSec: 60 * 60 * 6, // 6 часов реального времени
  },
  {
    key: "ardvale_friend",
    title: "Друг Ардвейла",
    description: "Совет Ардвейла принял тебя как своего.",
    icon: "handshake",
    buffJson: {},
    buffDurationSec: 0,
  },
  {
    key: "first_blood",
    title: "Первая Кровь",
    description: "Победил первого врага.",
    icon: "swords",
    buffJson: {},
    buffDurationSec: 0,
  },
  {
    key: "referrer",
    title: "Призыватель",
    description: "Привёл нового странника в Альтеру.",
    icon: "user-plus",
    buffJson: {},
    buffDurationSec: 0,
  },
];

export async function seedWorldIfEmpty(log: Logger): Promise<void> {
  // Locations
  const existingLocs = await db.select({ id: locations.id }).from(locations);
  const haveLoc = new Set(existingLocs.map((l) => l.id));
  // v2 — derive a 0..5 danger tier from `recommendedLevel` so the map UX can
  // colour-rank zones consistently. Safe = 0, lethal frontier = 5.
  const dangerOf = (l: (typeof LOCATIONS)[number]): number => {
    if (l.isSafe) return 0;
    const lvl = l.recommendedLevel ?? 1;
    if (lvl <= 1) return 1;
    if (lvl <= 2) return 2;
    if (lvl <= 3) return 3;
    if (lvl <= 4) return 4;
    return 5;
  };

  const newLocs = LOCATIONS.filter((l) => !haveLoc.has(l.id)).map((l) => ({
    id: l.id,
    name: l.name,
    region: l.region,
    description: l.description,
    type: l.type,
    isSafe: l.isSafe,
    isStarter: l.id === "ardvale_square",
    connectedTo: l.connectedTo,
    coordX: l.coordX,
    coordY: l.coordY,
    isFrontier: l.isFrontier ?? false,
    isGenerated: false,
    cityLevel: l.cityLevel ?? 0,
    requiresGuard: l.requiresGuard ?? false,
    destinationCityId: l.destinationCityId ?? null,
    dangerLevel: dangerOf(l),
    recommendedLevel: l.recommendedLevel ?? 1,
  }));
  if (newLocs.length > 0) {
    await db.insert(locations).values(newLocs);
    log.info({ inserted: newLocs.length }, "World seed: locations inserted");
  }

  // Always-resync graph metadata so canonical map (P7 starter rewrite)
  // overwrites any drift from old seeds. Adjacency is the source of truth
  // in `lore.ts`, NOT in the DB. AI-generated locations keep their own edges
  // because they are not in `LOCATIONS`.
  for (const l of LOCATIONS) {
    await db
      .update(locations)
      .set({
        name: l.name,
        region: l.region,
        description: l.description,
        type: l.type,
        isSafe: l.isSafe,
        connectedTo: l.connectedTo,
        coordX: l.coordX,
        coordY: l.coordY,
        isFrontier: l.isFrontier ?? false,
        cityLevel: l.cityLevel ?? 0,
        requiresGuard: l.requiresGuard ?? false,
        destinationCityId: l.destinationCityId ?? null,
        dangerLevel: dangerOf(l),
        recommendedLevel: l.recommendedLevel ?? 1,
      })
      .where(eq(locations.id, l.id));
  }

  // Factions
  const existingFac = await db.select({ key: factions.key }).from(factions);
  const haveFac = new Set(existingFac.map((f) => f.key));
  const newFac = FACTION_SEED.filter((f) => !haveFac.has(f.key));
  if (newFac.length > 0) {
    await db.insert(factions).values(newFac);
    log.info({ inserted: newFac.length }, "World seed: factions inserted");
  }

  // Quests
  const existingQ = await db.select({ id: quests.id }).from(quests);
  const haveQ = new Set(existingQ.map((q) => q.id));
  const newQ = QUEST_SEED.filter((q) => !haveQ.has(q.id));
  if (newQ.length > 0) {
    await db.insert(quests).values(newQ);
    log.info({ inserted: newQ.length }, "World seed: quests inserted");
  }

  // Achievements
  const existingA = await db.select({ key: achievements.key }).from(achievements);
  const haveA = new Set(existingA.map((a) => a.key));
  const newA = ACHIEVEMENT_SEED.filter((a) => !haveA.has(a.key));
  if (newA.length > 0) {
    await db.insert(achievements).values(newA);
    log.info({ inserted: newA.length }, "World seed: achievements inserted");
  }

  // Bestiary entries — pre-create empty rows so the discovery counter can increment
  const existingB = await db.select({ key: bestiary.key }).from(bestiary);
  const haveB = new Set(existingB.map((b) => b.key));
  const newB = ENEMIES.filter((e) => !haveB.has(e.key)).map((e) => ({
    key: e.key,
    name: e.name,
    lore: e.lore,
    level: e.level,
    locationId: e.locationId,
    encounterCount: 0,
  }));
  if (newB.length > 0) {
    await db.insert(bestiary).values(newB);
    log.info({ inserted: newB.length }, "World seed: bestiary inserted (empty)");
  }
}
