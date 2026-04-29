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
  type: string;
  isSafe: boolean;
}

export const LOCATIONS: LocationData[] = [
  {
    id: "ardvale_square",
    name: "Площадь Ардвейла",
    region: "Эхо Пепла",
    description:
      "Центральная площадь старого города. Свет факелов дрожит на влажных камнях, и шёпот горожан затихает, когда мимо проходит чужак.",
    type: "city",
    isSafe: true,
  },
  {
    id: "broken_chapel",
    name: "Сломленная Часовня",
    region: "Эхо Пепла",
    description:
      "Полуразрушенный храм забытого божества. Витражи лежат осколками на алтаре, и кто-то всё ещё зажигает свечи в полночь.",
    type: "ruin",
    isSafe: false,
  },
  {
    id: "ash_woods",
    name: "Пепельный Лес",
    region: "Эхо Пепла",
    description:
      "Деревья здесь обуглены до серебра, а земля помнит пожар, которого никто не видел. Между корнями шевелятся тени.",
    type: "wilderness",
    isSafe: false,
  },
  {
    id: "salt_market",
    name: "Соляной Рынок",
    region: "Маэранский Тракт",
    description:
      "Шум торговцев и резкий запах сушёной рыбы. Здесь продают всё — от пряностей до слухов, важно лишь, кто платит.",
    type: "market",
    isSafe: true,
  },
  {
    id: "moonwell_hollow",
    name: "Лощина Лунного Колодца",
    region: "Двулунные Земли",
    description:
      "Долина, где встречаются обе луны. Колодец отражает не лица, а намерения. Сахваки приходят сюда исповедоваться теням.",
    type: "shrine",
    isSafe: false,
  },
  {
    id: "stonefang_pass",
    name: "Перевал Каменного Клыка",
    region: "Карат",
    description:
      "Узкий горный проход. Ветер несёт песнь высеченных в скале имён — каждого, кто здесь пал.",
    type: "mountain",
    isSafe: false,
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
