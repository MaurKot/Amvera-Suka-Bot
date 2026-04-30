export interface RaceData {
  key: string;
  nameRu: string;
  nameEn: string;
  lore: string;
  creatureForm: string | null;
  bonuses: Record<string, number>;
}

export const RACES: RaceData[] = [
  {
    key: "ardaen",
    nameRu: "Ардаэн",
    nameEn: "Ardaen",
    lore: "Дети первого огня. Их кости тяжелее камня, а кровь теплее лавы. Живут в вулканических регионах Эха Пепла.",
    creatureForm: "fire_elemental",
    bonuses: { hp: 20, strength: 3 },
  },
  {
    key: "velhari",
    nameRu: "Велхари",
    nameEn: "Velhari",
    lore: "Пепловый народ. Помнят обиды веками. Их кожа имеет оттенок остывшего пепла, глаза светятся в темноте.",
    creatureForm: "ash_wraith",
    bonuses: { mana: 20, intelligence: 3 },
  },
  {
    key: "sahvaki",
    nameRu: "Сахваки",
    nameEn: "Sahvaki",
    lore: "Двулунные. Их облик меняется с фазами двух лун Альтеры. Мастера теней и иллюзий.",
    creatureForm: "twin_shadow",
    bonuses: { agility: 4, intelligence: 2 },
  },
  {
    key: "syreth",
    nameRu: "Сирет",
    nameEn: "Syreth",
    lore: "Болотные. Связаны с коллективной памятью топий. Могут дышать под водой и чувствовать вибрации земли.",
    creatureForm: "swamp_ancient",
    bonuses: { hp: 10, intelligence: 2 },
  },
  {
    key: "maeran",
    nameRu: "Маэран",
    nameEn: "Maeran",
    lore: "Торговцы. Лучшие дипломаты Альтеры. Не имеют магических даров, но их золото открывает любые двери.",
    creatureForm: null,
    bonuses: { silver_start: 20 },
  },
  {
    key: "alvenori",
    nameRu: "Альвенори",
    nameEn: "Alvenori",
    lore: "Старейшие. Помнят Первозданных. Хрупкие телом, но могущественные разумом. Умирают от старости первыми.",
    creatureForm: "star_walker",
    bonuses: { mana: 30, intelligence: 5, hp: -10 },
  },
  {
    key: "thornwood",
    nameRu: "Торнвуд",
    nameEn: "Thornwood",
    lore: "Лесные. Заключили договор с духами природы. Их волосы похожи на листву, кожа — на кору.",
    creatureForm: "forest_guardian",
    bonuses: { agility: 3, mana: 10 },
  },
  {
    key: "karath",
    nameRu: "Карат",
    nameEn: "Karath",
    lore: "Горные. Каждое поражение — урок. Высекают города в скалах и поклоняются камню.",
    creatureForm: "stone_titan",
    bonuses: { strength: 5, hp: 15, agility: -2 },
  },
  {
    key: "hadrani",
    nameRu: "Хадрани",
    nameEn: "Hadrani",
    lore: "Пустынные. Ничего не боятся, ибо видели худшее и выжили. Кочевники Эха Пустоши.",
    creatureForm: "sand_storm",
    bonuses: { strength: 3, agility: 2 },
  },
  {
    key: "lumenar",
    nameRu: "Люменар",
    nameEn: "Lumenar",
    lore: "Двукровные. Лучшее сопротивление магии. Родились от союза людей и существ света.",
    creatureForm: "light_bearer",
    bonuses: { mana: 20, intelligence: 2, strength: -2 },
  },
];

export interface CharClassData {
  key: string;
  nameRu: string;
  desc: string;
  resource: string;
  startStats: Record<string, number>;
}

export const CLASSES: CharClassData[] = [
  {
    key: "echo_blade",
    nameRu: "Воин Эха",
    desc: "Использует ярость боя для усиления ударов. Чем дольше бой, тем сильнее воин.",
    resource: "rage",
    startStats: { strength: 12, agility: 10, endurance: 12, intelligence: 8 },
  },
  {
    key: "rune_weaver",
    nameRu: "Плетущий Руны",
    desc: "Управляет потоками магии через руны. Концентрация влияет на точность заклинаний.",
    resource: "mana",
    startStats: { strength: 8, agility: 9, endurance: 9, intelligence: 14 },
  },
  {
    key: "dawn_archer",
    nameRu: "Лучник Рассвета",
    desc: "Мастер дистанционного боя. Фокус накапливается при неподвижности.",
    resource: "focus",
    startStats: { strength: 9, agility: 13, endurance: 10, intelligence: 8 },
  },
  {
    key: "shadow_seeker",
    nameRu: "Ищущий Тень",
    desc: "Удары из тени, комбо-атаки. Способен красть навыки у NPC.",
    resource: "shadow",
    startStats: { strength: 9, agility: 14, endurance: 8, intelligence: 9 },
  },
  {
    key: "echo_warden",
    nameRu: "Хранитель Эха",
    desc: "Защитник, использующий святую силу. Ауры поддерживают союзников.",
    resource: "holy_power",
    startStats: { strength: 11, agility: 8, endurance: 13, intelligence: 10 },
  },
  {
    key: "pact_hunter",
    nameRu: "Охотник Договора",
    desc: "Использует знаки и яды. Токсичность требует контроля, иначе навредит самому охотнику.",
    resource: "signs",
    startStats: { strength: 10, agility: 12, endurance: 10, intelligence: 10 },
  },
];

export interface LocationData {
  id: string;
  name: string;
  region: string;
  description: string;
  /** Visual icon hint: city | meadow | forest | hills | marsh | ruin | river | mine | wilderness | passage | shrine | mountain | market */
  type: string;
  isSafe: boolean;
  /** Adjacency list — every edge is bidirectional, the seed wires both sides. */
  connectedTo: string[];
  /** Schematic minimap coordinates (≈ -1.0..1.5). Master AI may extend the graph. */
  coordX: number;
  coordY: number;
  /** Frontier locations may be extended by the Master AI procedural generator. */
  isFrontier?: boolean;
  /** Settlement size: 0 = wilderness, 1 = town, 2+ = city. Used for guard checks. */
  cityLevel?: number;
  /** Recommended player level — used by combat encounter chance & guard warnings. */
  recommendedLevel?: number;
  /** True ⇒ traversal blocked by guard warning + combat encounter roll. */
  requiresGuard?: boolean;
  /** For passage locations: which city it leads to. Guard uses its cityLevel. */
  destinationCityId?: string;
}

// ───────────────────────────────────────────────────────────────────────────
// MANDATORY STARTER MAP — Город Ардвейл + 8 окрестностей + Тропа Торговца
// + Маэранский Кросс (вторая столица). Legacy nodes remain on the outskirts
// so existing NPCs and quests stay reachable.
// ───────────────────────────────────────────────────────────────────────────
export const LOCATIONS: LocationData[] = [
  // ═══════════════════════════════════════════════════════════════════════
  // STARTER CITY + 8 окрестностей
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: "ardvale_square",
    name: "Город Ардвейл",
    region: "Эхо Пепла",
    description:
      "Центральная площадь старого города. Свет факелов дрожит на влажных камнях, и шёпот горожан затихает, когда мимо проходит чужак. Отсюда расходятся восемь дорог в окрестности.",
    type: "city",
    isSafe: true,
    connectedTo: [
      "western_meadow",
      "eastern_forest",
      "northern_hills",
      "southern_marsh",
      "old_ruins",
      "river_crossing",
      "abandoned_mine",
      "hunting_grounds",
      "merchant_path",
    ],
    coordX: 0,
    coordY: 0,
    cityLevel: 1,
    recommendedLevel: 1,
  },
  {
    id: "western_meadow",
    name: "Западный луг",
    region: "Окрестности Ардвейла",
    description:
      "Высокая трава колышется на ветру; здесь пасутся чьи-то козы и иногда — нечто, что козами лишь притворяется. Безопасно для прибывших.",
    type: "meadow",
    isSafe: true,
    connectedTo: ["ardvale_square", "hunting_grounds"],
    coordX: -0.6,
    coordY: 0.1,
    recommendedLevel: 1,
  },
  {
    id: "eastern_forest",
    name: "Восточный лес",
    region: "Окрестности Ардвейла",
    description:
      "Густая чаща, где солнце едва пробивается сквозь кроны. Шуршание в подлеске не всегда от ветра.",
    type: "forest",
    isSafe: false,
    connectedTo: ["ardvale_square", "abandoned_mine", "hunting_grounds", "ash_woods"],
    coordX: 0.55,
    coordY: 0.15,
    recommendedLevel: 2,
    isFrontier: true,
  },
  {
    id: "northern_hills",
    name: "Северные холмы",
    region: "Окрестности Ардвейла",
    description:
      "Холмистые гряды, поросшие вереском. С вершины видно купол Сломленной Часовни и далёкие огни шахты.",
    type: "hills",
    isSafe: false,
    connectedTo: ["ardvale_square", "old_ruins", "abandoned_mine", "broken_chapel"],
    coordX: -0.1,
    coordY: 0.7,
    recommendedLevel: 2,
    isFrontier: true,
  },
  {
    id: "southern_marsh",
    name: "Южное болото",
    region: "Окрестности Ардвейла",
    description:
      "Топь, дышащая зелёным паром. Каждый шаг проверяешь жердью; местные говорят — болото помнит, кто его обманул.",
    type: "marsh",
    isSafe: false,
    connectedTo: ["ardvale_square", "river_crossing", "moonwell_hollow"],
    coordX: 0.15,
    coordY: -0.7,
    recommendedLevel: 3,
    isFrontier: true,
  },
  {
    id: "old_ruins",
    name: "Старые руины",
    region: "Окрестности Ардвейла",
    description:
      "Камни древнего форта, покрытые лишайником. На стенах ещё видны рисунки, которым никто не находит названия.",
    type: "ruin",
    isSafe: false,
    connectedTo: ["ardvale_square", "northern_hills", "broken_chapel"],
    coordX: -0.45,
    coordY: 0.95,
    recommendedLevel: 3,
  },
  {
    id: "river_crossing",
    name: "Речная переправа",
    region: "Окрестности Ардвейла",
    description:
      "Узкий деревянный мост через стылую реку. Перевозчик берёт дешевле, чем городские стражники.",
    type: "river",
    isSafe: true,
    connectedTo: ["ardvale_square", "southern_marsh"],
    coordX: 0.4,
    coordY: -0.4,
    recommendedLevel: 1,
  },
  {
    id: "abandoned_mine",
    name: "Заброшенная шахта",
    region: "Окрестности Ардвейла",
    description:
      "Зев старой шахты Каратов. Внутри пахнет ржавчиной и — еле различимо — чем-то живым, что не должно было выжить.",
    type: "mine",
    isSafe: false,
    connectedTo: ["northern_hills", "eastern_forest"],
    coordX: 0.55,
    coordY: 0.65,
    recommendedLevel: 4,
    isFrontier: true,
  },
  {
    id: "hunting_grounds",
    name: "Охотничьи угодья",
    region: "Окрестности Ардвейла",
    description:
      "Лесистая полоса, где охотники Торнвуд ставят силки. Обычные звери, но и тени, что охотятся на охотников.",
    type: "wilderness",
    isSafe: false,
    connectedTo: ["ardvale_square", "western_meadow", "eastern_forest"],
    coordX: -0.55,
    coordY: -0.4,
    recommendedLevel: 2,
  },

  // ═══════════════════════════════════════════════════════════════════════
  // ТРОПА ТОРГОВЦА — guarded passage to second city
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: "merchant_path",
    name: "Тропа Торговца",
    region: "Маэранский Тракт",
    description:
      "Утоптанная дорога между двумя столицами. Стража у ворот предупреждает: на пути встречаются разбойники, что охотятся на неопытных.",
    type: "passage",
    isSafe: false,
    connectedTo: ["ardvale_square", "maeran_kross"],
    coordX: -1.0,
    coordY: 0,
    recommendedLevel: 3,
    requiresGuard: true,
    destinationCityId: "maeran_kross",
  },
  {
    id: "maeran_kross",
    name: "Маэранский Кросс",
    region: "Маэранский Тракт",
    description:
      "Высокие башни торгового города. Каждая улица пахнет специями, каждая улыбка — подсчитывает твоё серебро. Опытные искатели здесь свои.",
    type: "city",
    isSafe: true,
    connectedTo: ["merchant_path", "salt_market", "stonefang_pass"],
    coordX: -1.5,
    coordY: 0,
    cityLevel: 5,
    recommendedLevel: 5,
  },

  // ═══════════════════════════════════════════════════════════════════════
  // LEGACY OUTLYING LOCATIONS (preserved so existing NPCs remain reachable)
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: "broken_chapel",
    name: "Сломленная Часовня",
    region: "Эхо Пепла",
    description:
      "Полуразрушенный храм забытого божества. Витражи лежат осколками на алтаре, и кто-то всё ещё зажигает свечи в полночь.",
    type: "ruin",
    isSafe: false,
    connectedTo: ["northern_hills", "old_ruins"],
    coordX: -0.6,
    coordY: 1.25,
    isFrontier: true,
    recommendedLevel: 4,
  },
  {
    id: "ash_woods",
    name: "Пепельный Лес",
    region: "Эхо Пепла",
    description:
      "Деревья здесь обуглены до серебра, а земля помнит пожар, которого никто не видел. Между корнями шевелятся тени.",
    type: "forest",
    isSafe: false,
    connectedTo: ["eastern_forest"],
    coordX: 1.05,
    coordY: 0.3,
    isFrontier: true,
    recommendedLevel: 3,
  },
  {
    id: "salt_market",
    name: "Соляной Рынок",
    region: "Маэранский Тракт",
    description:
      "Шум торговцев и резкий запах сушёной рыбы. Здесь продают всё — от пряностей до слухов, важно лишь, кто платит.",
    type: "market",
    isSafe: true,
    connectedTo: ["maeran_kross"],
    coordX: -1.85,
    coordY: 0.25,
    cityLevel: 3,
    recommendedLevel: 4,
  },
  {
    id: "moonwell_hollow",
    name: "Лощина Лунного Колодца",
    region: "Двулунные Земли",
    description:
      "Долина, где встречаются обе луны. Колодец отражает не лица, а намерения. Сахваки приходят сюда исповедоваться теням.",
    type: "shrine",
    isSafe: false,
    connectedTo: ["southern_marsh"],
    coordX: 0.3,
    coordY: -1.05,
    isFrontier: true,
    recommendedLevel: 4,
  },
  {
    id: "stonefang_pass",
    name: "Перевал Каменного Клыка",
    region: "Карат",
    description:
      "Узкий горный проход. Ветер несёт песнь высеченных в скале имён — каждого, кто здесь пал.",
    type: "mountain",
    isSafe: false,
    connectedTo: ["maeran_kross"],
    coordX: -1.65,
    coordY: -0.55,
    isFrontier: true,
    recommendedLevel: 5,
  },
];

export interface EnemyTemplateData {
  key: string;
  name: string;
  level: number;
  hp: number;
  damage: number;
  rewardSilver: number;
  rewardExp: number;
  locationId: string;
  lore: string;
}

export const ENEMIES: EnemyTemplateData[] = [
  {
    key: "ash_wolf",
    name: "Пепельный волк",
    level: 1,
    hp: 38,
    damage: 6,
    rewardSilver: 12,
    rewardExp: 30,
    locationId: "ash_woods",
    lore: "Серая тень с угольными глазами. Охотится в одиночку и помнит запах обидчиков.",
  },
  {
    key: "broken_pilgrim",
    name: "Сломленный пилигрим",
    level: 2,
    hp: 55,
    damage: 9,
    rewardSilver: 22,
    rewardExp: 55,
    locationId: "broken_chapel",
    lore: "Тот, кто когда-то молился здесь, и забыл, кому. Глаза его пусты, но руки ещё помнят посох.",
  },
  {
    key: "swamp_thrall",
    name: "Болотный невольник",
    level: 3,
    hp: 78,
    damage: 12,
    rewardSilver: 35,
    rewardExp: 90,
    locationId: "moonwell_hollow",
    lore: "Кожа цвета ила, дыхание — туман. Шепчет имена тех, кто его утопил.",
  },
  {
    key: "stonefang_brigand",
    name: "Разбойник Каменного Клыка",
    level: 4,
    hp: 95,
    damage: 14,
    rewardSilver: 50,
    rewardExp: 130,
    locationId: "stonefang_pass",
    lore: "Бывший наёмник, сбежавший с поля сожжённой деревни. Ножи у него двух разных фракций.",
  },
  {
    key: "market_cutpurse",
    name: "Рыночный резатель кошельков",
    level: 1,
    hp: 30,
    damage: 5,
    rewardSilver: 18,
    rewardExp: 25,
    locationId: "salt_market",
    lore: "Лёгкий на руку. Не убивает, если можно бежать.",
  },
  // ── New starter-map enemies ────────────────────────────────────────────
  {
    key: "field_hare",
    name: "Полевой заяц",
    level: 1,
    hp: 18,
    damage: 3,
    rewardSilver: 6,
    rewardExp: 12,
    locationId: "western_meadow",
    lore: "Слишком крупный, слишком тихий. Местные знают: луговой заяц укусит первым.",
  },
  {
    key: "woodland_lurker",
    name: "Лесной притаившийся",
    level: 2,
    hp: 42,
    damage: 7,
    rewardSilver: 16,
    rewardExp: 38,
    locationId: "eastern_forest",
    lore: "Сгорбленная тень в листве. Поджидает путников у тропы и бьёт сзади.",
  },
  {
    key: "hill_marauder",
    name: "Холмовой мародёр",
    level: 2,
    hp: 50,
    damage: 8,
    rewardSilver: 22,
    rewardExp: 45,
    locationId: "northern_hills",
    lore: "Беглый солдат, что разбойничает у вересковых троп. Носит цвета двух фракций.",
  },
  {
    key: "marsh_leech",
    name: "Болотная пиявка",
    level: 3,
    hp: 60,
    damage: 10,
    rewardSilver: 28,
    rewardExp: 70,
    locationId: "southern_marsh",
    lore: "Размером с собаку, прозрачная как стекло. Пьёт кровь и память одновременно.",
  },
  {
    key: "ruin_revenant",
    name: "Привидение руин",
    level: 3,
    hp: 70,
    damage: 11,
    rewardSilver: 32,
    rewardExp: 80,
    locationId: "old_ruins",
    lore: "Тот, кто не успел уйти, когда форт сожгли. До сих пор обходит караулы.",
  },
  {
    key: "river_drowned",
    name: "Утопленник переправы",
    level: 2,
    hp: 45,
    damage: 8,
    rewardSilver: 18,
    rewardExp: 42,
    locationId: "river_crossing",
    lore: "Вылезает из стылой воды по ночам. Помнит лица тех, кто не платил перевозчику.",
  },
  {
    key: "mine_horror",
    name: "Шахтная тварь",
    level: 4,
    hp: 110,
    damage: 16,
    rewardSilver: 60,
    rewardExp: 160,
    locationId: "abandoned_mine",
    lore: "Бесформенная масса с десятком конечностей. Каратовы кузнецы запечатали шахту не зря.",
  },
  {
    key: "hunters_quarry",
    name: "Озлобленный волк",
    level: 2,
    hp: 48,
    damage: 9,
    rewardSilver: 24,
    rewardExp: 50,
    locationId: "hunting_grounds",
    lore: "Раненый зверь, которого охотник бросил недобитым. Теперь он охотится сам.",
  },
  {
    key: "merchant_path_bandit",
    name: "Разбойник Тропы",
    level: 3,
    hp: 75,
    damage: 12,
    rewardSilver: 38,
    rewardExp: 95,
    locationId: "merchant_path",
    lore: "Ставит засады на караваны. Знает в лицо стражу обеих столиц.",
  },
];

export function getRace(key: string): RaceData | undefined {
  return RACES.find((r) => r.key === key);
}

export function getCharClass(key: string): CharClassData | undefined {
  return CLASSES.find((c) => c.key === key);
}

export function getLocation(id: string): LocationData | undefined {
  return LOCATIONS.find((l) => l.id === id);
}

export function getEnemy(key: string): EnemyTemplateData | undefined {
  return ENEMIES.find((e) => e.key === key);
}
