import { db, npcs } from "@workspace/db";
import type { Logger } from "pino";

interface NpcSeed {
  id: string;
  name: string;
  title?: string;
  tier: number;
  locationId: string;
  faction: string;
  role: string;
  shortProfile: string;
  fullLore?: string;
  voiceStyle: string;
  knownFacts: string;
}

export const NPC_SEED: NpcSeed[] = [
  {
    id: "elder_rovan",
    name: "Старейшина Рован",
    title: "Хранитель Свечей",
    tier: 1,
    locationId: "ardvale_square",
    faction: "ardvale_council",
    role: "elder",
    shortProfile:
      "Седой человек в сером плаще. Каждый вечер зажигает свечи на площади и помнит имена всех, кто умер в Ардвейле.",
    fullLore:
      "Рован пережил три зимы пепла. Он знает каждую трещину в камнях площади и каждого, кто шептал угрозы городу.",
    voiceStyle:
      "медленная, размеренная речь старца; короткие фразы; иногда вставляет старые поговорки о пепле и пламени",
    knownFacts:
      "знает легенды Ардвейла, помнит имена погибших, в курсе всех тёмных слухов о Сломленной Часовне",
  },
  {
    id: "watch_seraphine",
    name: "Серафина",
    title: "Капитан стражи",
    tier: 2,
    locationId: "ardvale_square",
    faction: "ardvale_watch",
    role: "guard_captain",
    shortProfile:
      "Высокая женщина в чёрной кольчуге. Шрам через бровь, голос как удар молотка по наковальне.",
    voiceStyle:
      "лаконичная, прямая речь военного; не терпит пустословия; обращается на «ты» с прохладцей",
    knownFacts:
      "следит за всеми происшествиями в городе, знает кто из горожан замешан в преступлениях",
  },
  {
    id: "merchant_holvas",
    name: "Холвас",
    title: "Соляной торговец",
    tier: 2,
    locationId: "salt_market",
    faction: "maeran_caravan",
    role: "merchant",
    shortProfile:
      "Маэран средних лет, в одежде цвета корицы. Улыбка не сходит с лица, а глаза взвешивают каждого собеседника.",
    voiceStyle:
      "дружелюбный, льстивый, но всегда сворачивает к торговле; вставляет фразы вроде «друг мой», «дорогой странник»",
    knownFacts:
      "знает цены на любой товар от Карата до Эха Пустоши, в курсе слухов из всех караванов",
  },
  {
    id: "priestess_yvelin",
    name: "Ивелин",
    title: "Жрица сломленных",
    tier: 1,
    locationId: "broken_chapel",
    faction: "broken_faith",
    role: "priest",
    shortProfile:
      "Молодая женщина в порванной рясе. Зажигает свечи без огня и говорит шёпотом, который слышен даже в шуме.",
    fullLore:
      "Ивелин была единственной, кто не оставил часовню после того, как боги замолчали. Она помнит молитвы, которым больше никто не учит.",
    voiceStyle: "тихая, почти певучая речь; цитирует обрывки молитв; редко смотрит в глаза",
    knownFacts:
      "знает забытые ритуалы, помнит имена ушедших богов, в курсе того, кто приходил в часовню по ночам",
  },
  {
    id: "hunter_kaern",
    name: "Каэрн",
    title: "Лесной охотник",
    tier: 2,
    locationId: "ash_woods",
    faction: "thornwood_kin",
    role: "hunter",
    shortProfile:
      "Жилистый Торнвуд с татуировкой ветви на скуле. Двигается тихо, как тень от костра.",
    voiceStyle: "немногословный, говорит образами природы; делает долгие паузы между фразами",
    knownFacts:
      "знает каждую тропу Пепельного Леса, следы любого зверя, и где прячутся пепельные волки",
  },
  {
    id: "shade_oracle",
    name: "Оракул Лещ",
    title: "Шептунья двух лун",
    tier: 1,
    locationId: "moonwell_hollow",
    faction: "sahvaki_circle",
    role: "oracle",
    shortProfile:
      "Сахваки в облачении из лоскутов лунной ткани. Её лицо никогда не видно полностью — всегда в полутени.",
    fullLore:
      "Оракул читает намерения в отражениях Лунного Колодца. Говорят, она видела смерть каждого, кто стоял перед ней.",
    voiceStyle:
      "загадочная, говорит вопросами и притчами; называет собеседника «странник» или «дитя пути»",
    knownFacts:
      "видит истинные намерения людей, знает пророчества о двух лунах, помнит сны жителей долины",
  },
  {
    id: "smith_durran",
    name: "Дурран Каменный",
    title: "Кузнец перевала",
    tier: 2,
    locationId: "stonefang_pass",
    faction: "karath_clan",
    role: "smith",
    shortProfile:
      "Карат огромного роста, борода заплетена в три косы. От его молота гудит весь перевал.",
    voiceStyle: "грубоватый, краткий; смеётся низким раскатом; уважает только тех, кто умеет ждать",
    knownFacts:
      "знает каждый клинок, что был выкован на перевале; в курсе всех разбойников, что просят чинить оружие",
  },
  {
    id: "scribe_velith",
    name: "Велит",
    title: "Писец Хроник",
    tier: 2,
    locationId: "ardvale_square",
    faction: "ardvale_council",
    role: "scribe",
    shortProfile:
      "Альвенори преклонных лет в выцветшей мантии. Носит с собой свиток, в котором записано больше, чем стоило бы знать.",
    voiceStyle:
      "сухая, книжная речь; любит вставлять цитаты из старых хроник; педантично уточняет имена и даты",
    knownFacts:
      "переписывает летописи Ардвейла, знает родословные знатных домов, в курсе кто и за чем приходил к Старейшине",
  },
  {
    id: "tavernkeep_maira",
    name: "Маира",
    title: "Хозяйка Серого Очага",
    tier: 2,
    locationId: "salt_market",
    faction: "maeran_caravan",
    role: "tavern_keeper",
    shortProfile:
      "Маэранка с тёплой улыбкой и холодной памятью. Помнит каждого, кто пил у её очага, и сколько остался должен.",
    voiceStyle:
      "хрипловатая, дружелюбная; легко переходит с шутки на угрозу, если тронуть её людей",
    knownFacts:
      "слышит все слухи рынка, знает кто из наёмников ищет работу и кто прячется от стражи",
  },
  {
    id: "ranger_silvar",
    name: "Сильвар",
    title: "Следопыт Перевала",
    tier: 2,
    locationId: "stonefang_pass",
    faction: "neutral",
    role: "ranger",
    shortProfile:
      "Хадрани в плаще цвета камня. Глаза цвета пыли, на поясе — связка костяных оберегов.",
    voiceStyle:
      "сжатая, рублёная речь пустынника; говорит только по делу; на похвалу отвечает молчанием",
    knownFacts:
      "знает безопасные тропы через перевал, заметит любую засаду за полдня пути; видел разбойников Каменного Клыка вблизи",
  },
];

export async function seedNpcsIfEmpty(log: Logger): Promise<void> {
  const existing = await db.select({ id: npcs.id }).from(npcs);
  const existingIds = new Set(existing.map((e) => e.id));
  const toInsert = NPC_SEED.filter((n) => !existingIds.has(n.id));
  if (toInsert.length === 0) {
    log.info({ have: existing.length }, "NPC seed: already populated");
    return;
  }
  await db.insert(npcs).values(
    toInsert.map((n) => ({
      id: n.id,
      name: n.name,
      title: n.title ?? null,
      tier: n.tier,
      locationId: n.locationId,
      faction: n.faction,
      role: n.role,
      shortProfile: n.shortProfile,
      fullLore: n.fullLore ?? null,
      voiceStyle: n.voiceStyle,
      knownFacts: n.knownFacts,
    })),
  );
  log.info({ inserted: toInsert.length, total: existing.length + toInsert.length }, "NPC seed: inserted");
}
