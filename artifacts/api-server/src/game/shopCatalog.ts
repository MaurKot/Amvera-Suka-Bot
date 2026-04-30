export interface ShopCatalogItem {
  catalogKey: string;
  itemKey: string;
  name: string;
  itemType: "weapon" | "armor" | "trinket" | "potion" | "misc";
  rarity: "common" | "uncommon" | "rare" | "epic" | "legendary";
  price: number;
  description: string;
  stats: Record<string, number>;
  stackable: boolean;
}

export interface ShopCatalog {
  npcId: string;
  greeting: string;
  items: ShopCatalogItem[];
}

// ───────────────────────────────────────────────────────────────────────────
// P7 — Tripled item catalogue across all merchants. 5 rarities now:
// common · uncommon · rare · epic · legendary. Every merchant carries goods
// across at least 4 of the 5 item categories.
// ───────────────────────────────────────────────────────────────────────────
const CATALOGS: Record<string, ShopCatalog> = {
  merchant_holvas: {
    npcId: "merchant_holvas",
    greeting:
      "А-а, мой друг! Заходи, заходи. Глаза твои говорят — у тебя есть серебро, и я знаю, на что его потратить.",
    items: [
      // ── Weapons ────────────────────────────────────────────────────────
      { catalogKey: "salt_dagger", itemKey: "salt_dagger", name: "Соляной кинжал", itemType: "weapon", rarity: "common", price: 60,
        description: "Лезвие, потемневшее от морской соли. Лёгкое, быстрое, не подведёт в переулке.",
        stats: { damage: 4 }, stackable: false },
      { catalogKey: "caravan_short_sword", itemKey: "caravan_short_sword", name: "Короткий меч каравана", itemType: "weapon", rarity: "common", price: 95,
        description: "Простой клинок маэранской охраны. Без украшений, но баланс честный.",
        stats: { damage: 6 }, stackable: false },
      { catalogKey: "trader_crossbow", itemKey: "trader_crossbow", name: "Купеческий арбалет", itemType: "weapon", rarity: "uncommon", price: 240,
        description: "Складной, помещается под плащ. Холвас уверяет — стрела летит дальше предупреждения.",
        stats: { damage: 9, agility: 1 }, stackable: false },
      { catalogKey: "spice_blade", itemKey: "spice_blade", name: "Пряный клинок", itemType: "weapon", rarity: "rare", price: 520,
        description: "Лезвие, натёртое экзотическими маслами. Раны от него горят дольше.",
        stats: { damage: 12, bleed_chance: 15 }, stackable: false },
      // ── Armor ──────────────────────────────────────────────────────────
      { catalogKey: "caravan_cloak", itemKey: "caravan_cloak", name: "Караванный плащ", itemType: "armor", rarity: "common", price: 80,
        description: "Тяжёлая ткань цвета корицы. Защищает от ножа, ветра и недобрых взглядов.",
        stats: { armor: 3 }, stackable: false },
      { catalogKey: "merchant_vest", itemKey: "merchant_vest", name: "Жилет торговца", itemType: "armor", rarity: "common", price: 110,
        description: "Многослойная кожа. Не парадная, но первый удар погасит.",
        stats: { armor: 4 }, stackable: false },
      { catalogKey: "scaled_brigandine", itemKey: "scaled_brigandine", name: "Чешуйчатая бригантина", itemType: "armor", rarity: "uncommon", price: 290,
        description: "Маэранский фасон. Чешуйки нашиты на кожу — гибкая и надёжная.",
        stats: { armor: 7 }, stackable: false },
      // ── Potions ────────────────────────────────────────────────────────
      { catalogKey: "healing_draught", itemKey: "healing_draught", name: "Целебная настойка", itemType: "potion", rarity: "common", price: 35,
        description: "Маэранский рецепт. Пахнет травой, на вкус — кровь и мёд. Восстанавливает 30 HP.",
        stats: { heal: 30 }, stackable: true },
      { catalogKey: "greater_healing", itemKey: "greater_healing", name: "Большая настойка", itemType: "potion", rarity: "uncommon", price: 90,
        description: "Концентрат. Восстанавливает 70 HP, но горло жжёт минуту.",
        stats: { heal: 70 }, stackable: true },
      { catalogKey: "antidote_phial", itemKey: "antidote_phial", name: "Флакон противоядия", itemType: "potion", rarity: "uncommon", price: 70,
        description: "Снимает яд. Берегите от прямого солнца.",
        stats: { cure_poison: 1 }, stackable: true },
      // ── Trinkets ───────────────────────────────────────────────────────
      { catalogKey: "merchant_ring", itemKey: "merchant_ring", name: "Кольцо торговца", itemType: "trinket", rarity: "uncommon", price: 220,
        description: "Маленькая печатка маэранского дома. Открывает уши хозяев.",
        stats: { luck: 1 }, stackable: false },
      { catalogKey: "spice_pendant", itemKey: "spice_pendant", name: "Кулон со специями", itemType: "trinket", rarity: "rare", price: 480,
        description: "Запах перебивает магию страха. Полезен в подземельях.",
        stats: { fear_resist: 25 }, stackable: false },
      { catalogKey: "trader_seal", itemKey: "trader_seal", name: "Печать гильдии Маэран", itemType: "trinket", rarity: "epic", price: 1200,
        description: "Личная гарантия Холваса. Скидки в любом маэранском городе.",
        stats: { silver_gain: 10, luck: 2 }, stackable: false },
      // ── Misc ───────────────────────────────────────────────────────────
      { catalogKey: "spice_pouch", itemKey: "spice_pouch", name: "Мешочек пряностей", itemType: "misc", rarity: "uncommon", price: 120,
        description: "Дороже золота в северных городах. Хороший подарок для NPC.",
        stats: {}, stackable: true },
      { catalogKey: "merchant_map", itemKey: "merchant_map", name: "Торговая карта", itemType: "misc", rarity: "rare", price: 380,
        description: "Маэраны рисуют тропы тушью из кальмара. Открывает скрытые узлы карты.",
        stats: {}, stackable: false },
    ],
  },

  smith_durran: {
    npcId: "smith_durran",
    greeting:
      "Хм. Смотришь, как вода смотрит на камень. Если есть серебро — есть и сталь. Выбирай.",
    items: [
      // ── Weapons ────────────────────────────────────────────────────────
      { catalogKey: "iron_axe", itemKey: "iron_axe", name: "Железный топор", itemType: "weapon", rarity: "common", price: 75,
        description: "Простой топор без изысков. Каждый каратский ребёнок учится с такого.",
        stats: { damage: 5 }, stackable: false },
      { catalogKey: "stonefang_blade", itemKey: "stonefang_blade", name: "Клинок Каменного Клыка", itemType: "weapon", rarity: "uncommon", price: 220,
        description: "Выкован при свете трёх плавок. Тяжёлый, как обещание.",
        stats: { damage: 8 }, stackable: false },
      { catalogKey: "twin_hammer", itemKey: "twin_hammer", name: "Двуручный молот", itemType: "weapon", rarity: "uncommon", price: 280,
        description: "Двумя руками — стену проломит. Одной — рубашку.",
        stats: { damage: 11, stun_chance: 20 }, stackable: false },
      { catalogKey: "rune_etched_blade", itemKey: "rune_etched_blade", name: "Клинок с рунами", itemType: "weapon", rarity: "rare", price: 580,
        description: "Руны троих кузнецов. Удар проходит сквозь плотную тень.",
        stats: { damage: 14 }, stackable: false },
      { catalogKey: "stoneheart_warhammer", itemKey: "stoneheart_warhammer", name: "Молот Каменного Сердца", itemType: "weapon", rarity: "epic", price: 1450,
        description: "Реликвия Карат. Каждый удар — приговор.",
        stats: { damage: 22, stun_chance: 30 }, stackable: false },
      // ── Armor ──────────────────────────────────────────────────────────
      { catalogKey: "scout_chain", itemKey: "scout_chain", name: "Кольчуга разведчика", itemType: "armor", rarity: "common", price: 130,
        description: "Лёгкая, под плащ. Гасит первый удар, не сковывает движения.",
        stats: { armor: 4 }, stackable: false },
      { catalogKey: "karath_helm", itemKey: "karath_helm", name: "Шлем каратского клана", itemType: "armor", rarity: "uncommon", price: 180,
        description: "С рунами трёх кос. Не пропустит первый удар.",
        stats: { armor: 5 }, stackable: false },
      { catalogKey: "stone_plate", itemKey: "stone_plate", name: "Латы из горной стали", itemType: "armor", rarity: "rare", price: 620,
        description: "Глубокий тёмный отлив. Тяжёлая, но греет в любую зиму.",
        stats: { armor: 12, agility: -1 }, stackable: false },
      { catalogKey: "ancestor_mail", itemKey: "ancestor_mail", name: "Кольчуга предков", itemType: "armor", rarity: "legendary", price: 3200,
        description: "Снята с тела последнего короля Карат. Помнит, кому принадлежит.",
        stats: { armor: 18, endurance: 3, hp: 30 }, stackable: false },
      // ── Trinkets ───────────────────────────────────────────────────────
      { catalogKey: "iron_charm", itemKey: "iron_charm", name: "Железный оберег", itemType: "trinket", rarity: "common", price: 90,
        description: "Молот в кулаке. Каратский знак твёрдости духа.",
        stats: { endurance: 1 }, stackable: false },
      { catalogKey: "kos_pendant", itemKey: "kos_pendant", name: "Подвеска трёх кос", itemType: "trinket", rarity: "rare", price: 450,
        description: "Знак каратского старейшины. Удваивает сопротивление страху.",
        stats: { fear_resist: 50, strength: 1 }, stackable: false },
      // ── Misc ───────────────────────────────────────────────────────────
      { catalogKey: "whetstone", itemKey: "whetstone", name: "Точильный камень", itemType: "misc", rarity: "common", price: 25,
        description: "Простой брусок. Возвращает остроту стали.",
        stats: {}, stackable: true },
      { catalogKey: "repair_kit", itemKey: "repair_kit", name: "Походный ремонтник", itemType: "misc", rarity: "uncommon", price: 110,
        description: "Иголка, шило, маленький молоток. Чинит броню в полевых условиях.",
        stats: {}, stackable: true },
      // ── Potions ────────────────────────────────────────────────────────
      { catalogKey: "forge_tonic", itemKey: "forge_tonic", name: "Тоник кузнеца", itemType: "potion", rarity: "uncommon", price: 85,
        description: "Глоток, и в плечах теплеет. Временный +2 к силе на короткое время.",
        stats: { strength_buff: 2 }, stackable: true },
      { catalogKey: "stoneheart_brew", itemKey: "stoneheart_brew", name: "Каменное сердце", itemType: "potion", rarity: "rare", price: 280,
        description: "Густое варево. Даёт временный +20 брони.",
        stats: { armor_buff: 20 }, stackable: true },
    ],
  },

  tavernkeep_maira: {
    npcId: "tavernkeep_maira",
    greeting:
      "Садись, странник. Серый Очаг открыт для всех, кто платит. Что налить — или что унести с собой?",
    items: [
      // ── Potions ────────────────────────────────────────────────────────
      { catalogKey: "warm_stew", itemKey: "warm_stew", name: "Тарелка горячего варева", itemType: "potion", rarity: "common", price: 12,
        description: "Густо, остро и сытно. Восстанавливает 15 HP.",
        stats: { heal: 15 }, stackable: true },
      { catalogKey: "ash_wine", itemKey: "ash_wine", name: "Пепельное вино", itemType: "potion", rarity: "common", price: 20,
        description: "Терпкое, тёмное. Греет горло, не голову.",
        stats: { mana: 10 }, stackable: true },
      { catalogKey: "spiced_mead", itemKey: "spiced_mead", name: "Пряный мёд", itemType: "potion", rarity: "common", price: 18,
        description: "Сладкий и крепкий. Даёт +5 к мане и тёплое чувство в груди.",
        stats: { mana: 15 }, stackable: true },
      { catalogKey: "barbed_brew", itemKey: "barbed_brew", name: "Колючая настойка", itemType: "potion", rarity: "uncommon", price: 60,
        description: "Зелёная как трава, на вкус как иголки. Восстанавливает 40 HP и снимает кровотечение.",
        stats: { heal: 40, cure_bleed: 1 }, stackable: true },
      { catalogKey: "moonshade_brew", itemKey: "moonshade_brew", name: "Лунный отвар", itemType: "potion", rarity: "rare", price: 200,
        description: "Сахваки заваривают его раз в месяц. Снимает страх и оглушение.",
        stats: { cure_fear: 1, cure_stun: 1, heal: 25 }, stackable: true },
      // ── Misc ───────────────────────────────────────────────────────────
      { catalogKey: "rumour_token", itemKey: "rumour_token", name: "Слух с рынка", itemType: "misc", rarity: "uncommon", price: 45,
        description: "Маира шепчет имя. Не спрашивай, чьё.",
        stats: {}, stackable: true },
      { catalogKey: "bedroll", itemKey: "bedroll", name: "Скатанная постель", itemType: "misc", rarity: "common", price: 30,
        description: "На рынке спят на камнях. С этим — нет.",
        stats: {}, stackable: false },
      { catalogKey: "salted_rations", itemKey: "salted_rations", name: "Солёные припасы", itemType: "misc", rarity: "common", price: 22,
        description: "Хватит на три дня в пути. Не пахнут — это плюс.",
        stats: {}, stackable: true },
      { catalogKey: "lantern_oil", itemKey: "lantern_oil", name: "Лампадное масло", itemType: "misc", rarity: "common", price: 16,
        description: "Густое, без копоти. Шахту можно пройти и не задохнуться.",
        stats: {}, stackable: true },
      // ── Trinkets ───────────────────────────────────────────────────────
      { catalogKey: "tavern_keepsake", itemKey: "tavern_keepsake", name: "Жетон Серого Очага", itemType: "trinket", rarity: "uncommon", price: 95,
        description: "Маира узнаёт его в любой таверне. Скидка на ночлег.",
        stats: { silver_gain: 5 }, stackable: false },
      { catalogKey: "silver_thimble", itemKey: "silver_thimble", name: "Серебряный напёрсток", itemType: "trinket", rarity: "rare", price: 320,
        description: "Маэранская безделушка. Носят на счастье у обедненной торговли.",
        stats: { luck: 2 }, stackable: false },
      // ── Weapons (just one — Маира не оружейница) ───────────────────────
      { catalogKey: "kitchen_cleaver", itemKey: "kitchen_cleaver", name: "Кухонный тесак", itemType: "weapon", rarity: "common", price: 40,
        description: "Тяжёлый и неповоротливый. Но в драке — лучше, чем кулак.",
        stats: { damage: 3 }, stackable: false },
    ],
  },
};

const MERCHANT_ROLES = new Set(["merchant", "smith", "tavern_keeper"]);

export function isMerchantRole(role: string): boolean {
  return MERCHANT_ROLES.has(role);
}

export function getShopCatalog(npcId: string): ShopCatalog | null {
  return CATALOGS[npcId] ?? null;
}

export function getCatalogItem(npcId: string, catalogKey: string): ShopCatalogItem | null {
  const cat = CATALOGS[npcId];
  if (!cat) return null;
  return cat.items.find((i) => i.catalogKey === catalogKey) ?? null;
}
