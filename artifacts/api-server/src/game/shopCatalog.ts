export interface ShopCatalogItem {
  catalogKey: string;
  itemKey: string;
  name: string;
  itemType: "weapon" | "armor" | "trinket" | "potion" | "misc";
  rarity: "common" | "uncommon" | "rare";
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

const CATALOGS: Record<string, ShopCatalog> = {
  merchant_holvas: {
    npcId: "merchant_holvas",
    greeting:
      "А-а, мой друг! Заходи, заходи. Глаза твои говорят — у тебя есть серебро, и я знаю, на что его потратить.",
    items: [
      {
        catalogKey: "salt_dagger",
        itemKey: "salt_dagger",
        name: "Соляной кинжал",
        itemType: "weapon",
        rarity: "common",
        price: 60,
        description: "Лезвие, потемневшее от морской соли. Лёгкое, быстрое, не подведёт в переулке.",
        stats: { damage: 4 },
        stackable: false,
      },
      {
        catalogKey: "caravan_cloak",
        itemKey: "caravan_cloak",
        name: "Караванный плащ",
        itemType: "armor",
        rarity: "common",
        price: 80,
        description: "Тяжёлая ткань цвета корицы. Защищает от ножа, ветра и недобрых взглядов.",
        stats: { armor: 3 },
        stackable: false,
      },
      {
        catalogKey: "healing_draught",
        itemKey: "healing_draught",
        name: "Целебная настойка",
        itemType: "potion",
        rarity: "common",
        price: 35,
        description: "Маэранский рецепт. Пахнет травой, на вкус — кровь и мёд. Восстанавливает 30 HP.",
        stats: { heal: 30 },
        stackable: true,
      },
      {
        catalogKey: "spice_pouch",
        itemKey: "spice_pouch",
        name: "Мешочек пряностей",
        itemType: "misc",
        rarity: "uncommon",
        price: 120,
        description: "Дороже золота в северных городах. Хороший подарок для NPC.",
        stats: {},
        stackable: true,
      },
      {
        catalogKey: "merchant_ring",
        itemKey: "merchant_ring",
        name: "Кольцо торговца",
        itemType: "trinket",
        rarity: "uncommon",
        price: 220,
        description: "Маленькая печатка маэранского дома. Открывает уши хозяев.",
        stats: { luck: 1 },
        stackable: false,
      },
    ],
  },
  smith_durran: {
    npcId: "smith_durran",
    greeting:
      "Хм. Смотришь, как вода смотрит на камень. Если есть серебро — есть и сталь. Выбирай.",
    items: [
      {
        catalogKey: "stonefang_blade",
        itemKey: "stonefang_blade",
        name: "Клинок Каменного Клыка",
        itemType: "weapon",
        rarity: "uncommon",
        price: 220,
        description: "Выкован при свете трёх плавок. Тяжёлый, как обещание.",
        stats: { damage: 8 },
        stackable: false,
      },
      {
        catalogKey: "karath_helm",
        itemKey: "karath_helm",
        name: "Шлем каратского клана",
        itemType: "armor",
        rarity: "uncommon",
        price: 180,
        description: "С рунами трёх кос. Не пропустит первый удар.",
        stats: { armor: 5 },
        stackable: false,
      },
      {
        catalogKey: "whetstone",
        itemKey: "whetstone",
        name: "Точильный камень",
        itemType: "misc",
        rarity: "common",
        price: 25,
        description: "Простой брусок. Возвращает остроту стали.",
        stats: {},
        stackable: true,
      },
      {
        catalogKey: "iron_charm",
        itemKey: "iron_charm",
        name: "Железный оберег",
        itemType: "trinket",
        rarity: "common",
        price: 90,
        description: "Молот в кулаке. Каратский знак твёрдости духа.",
        stats: { endurance: 1 },
        stackable: false,
      },
    ],
  },
  tavernkeep_maira: {
    npcId: "tavernkeep_maira",
    greeting:
      "Садись, странник. Серый Очаг открыт для всех, кто платит. Что налить — или что унести с собой?",
    items: [
      {
        catalogKey: "warm_stew",
        itemKey: "warm_stew",
        name: "Тарелка горячего варева",
        itemType: "potion",
        rarity: "common",
        price: 12,
        description: "Густо, остро и сытно. Восстанавливает 15 HP.",
        stats: { heal: 15 },
        stackable: true,
      },
      {
        catalogKey: "ash_wine",
        itemKey: "ash_wine",
        name: "Пепельное вино",
        itemType: "potion",
        rarity: "common",
        price: 20,
        description: "Терпкое, тёмное. Греет горло, не голову.",
        stats: { mana: 10 },
        stackable: true,
      },
      {
        catalogKey: "rumour_token",
        itemKey: "rumour_token",
        name: "Слух с рынка",
        itemType: "misc",
        rarity: "uncommon",
        price: 45,
        description: "Маира шепчет имя. Не спрашивай, чьё.",
        stats: {},
        stackable: true,
      },
      {
        catalogKey: "bedroll",
        itemKey: "bedroll",
        name: "Скатанная постель",
        itemType: "misc",
        rarity: "common",
        price: 30,
        description: "На рынке спят на камнях. С этим — нет.",
        stats: {},
        stackable: false,
      },
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
