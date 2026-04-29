import { db, npcs } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { Logger } from "pino";

export interface QuestSeedTemplate {
  /** Short title shown in the quest log */
  title: string;
  /** What the NPC asks the player to do (free-form, used by the AI quest generator) */
  brief: string;
  /** Suggested mechanical objective: talk | kill | gather | explore | deliver */
  targetType: "talk" | "kill" | "gather" | "explore" | "deliver";
  /** Default target reference (location id, npc id, enemy key) */
  targetRef?: string;
  targetCount?: number;
  rewardSilverHint?: number;
  rewardExpHint?: number;
}

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
  // P3 — extended NPC profile for AI quest generation
  personality: string;
  motives: string;
  questPool: QuestSeedTemplate[];
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
    personality: "wise_patient",
    motives: "сохранить память города и не дать пеплу поглотить новых жильцов",
    questPool: [
      {
        title: "Свечи памяти",
        brief: "Зажги свечи в Сломленной Часовне в память о тех, кого там оставили.",
        targetType: "explore",
        targetRef: "broken_chapel",
        rewardSilverHint: 30,
        rewardExpHint: 40,
      },
      {
        title: "Расспроси писца",
        brief: "Поговори с Велитом о новых записях в хрониках — вдруг он что-то скрывает.",
        targetType: "talk",
        targetRef: "scribe_velith",
        rewardSilverHint: 20,
        rewardExpHint: 30,
      },
    ],
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
    personality: "stern_dutybound",
    motives: "удержать порядок в Ардвейле любой ценой и проверить каждого чужака",
    questPool: [
      {
        title: "Зачистка перевала",
        brief: "Уменьши число пепельных мародёров на перевале Каменного Клыка — стража отблагодарит.",
        targetType: "kill",
        targetRef: "ash_marauder",
        targetCount: 2,
        rewardSilverHint: 60,
        rewardExpHint: 90,
      },
      {
        title: "Проверка часовни",
        brief: "Загляни в Сломленную Часовню и доложи, кто и когда там жжёт свечи.",
        targetType: "explore",
        targetRef: "broken_chapel",
        rewardSilverHint: 25,
        rewardExpHint: 40,
      },
    ],
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
    personality: "greedy_charming",
    motives: "наживать серебро, окружить себя должниками и стать главой каравана",
    questPool: [
      {
        title: "Доставить узел",
        brief: "Отнеси небольшой свёрток Маире на тот же рынок — никаких вопросов.",
        targetType: "deliver",
        targetRef: "tavernkeep_maira",
        rewardSilverHint: 35,
        rewardExpHint: 25,
      },
      {
        title: "Сбор пряностей",
        brief: "Принеси редкие травы из Пепельного Леса — оплачу втридорога.",
        targetType: "gather",
        targetRef: "ash_woods",
        targetCount: 3,
        rewardSilverHint: 80,
        rewardExpHint: 60,
      },
    ],
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
    personality: "fragile_devout",
    motives: "вернуть голос богам и не дать часовне окончательно умереть",
    questPool: [
      {
        title: "Молчаливая молитва",
        brief: "Подойди к колодцу Лещ и попроси благословение богов от моего имени.",
        targetType: "talk",
        targetRef: "shade_oracle",
        rewardSilverHint: 15,
        rewardExpHint: 50,
      },
    ],
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
    personality: "gruff_loyal",
    motives: "оберегать лес и не дать чужакам тревожить духов природы",
    questPool: [
      {
        title: "След волка",
        brief: "Уменьши число пепельных волков — слишком близко подходят к деревне.",
        targetType: "kill",
        targetRef: "ash_wolf",
        targetCount: 2,
        rewardSilverHint: 50,
        rewardExpHint: 80,
      },
    ],
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
    personality: "cryptic_neutral",
    motives: "наблюдать за переплетением судеб и не дать миру свернуть с предначертанной тропы",
    questPool: [
      {
        title: "Имя в воде",
        brief: "Принеси мне отражение пути — пройди до Перевала Каменного Клыка и вернись.",
        targetType: "explore",
        targetRef: "stonefang_pass",
        rewardSilverHint: 40,
        rewardExpHint: 70,
      },
    ],
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
    personality: "stoic_proud",
    motives: "выковать оружие достойное камня и не дать перевалу пасть в руки мародёров",
    questPool: [
      {
        title: "Молот и кровь",
        brief: "Покажи перевалу, чего стоишь: уложи мародёра у входа.",
        targetType: "kill",
        targetRef: "ash_marauder",
        targetCount: 1,
        rewardSilverHint: 70,
        rewardExpHint: 110,
      },
    ],
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
    personality: "scholarly_curious",
    motives: "записать каждый штрих истории, прежде чем кто-то перепишет её первым",
    questPool: [
      {
        title: "Свидетельства",
        brief: "Поговори с тремя разными лицами в городе и принеси мне их слова.",
        targetType: "talk",
        targetRef: "elder_rovan",
        rewardSilverHint: 30,
        rewardExpHint: 50,
      },
    ],
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
    personality: "warm_iron",
    motives: "защитить таверну и собрать долги, которые ей задолжал весь рынок",
    questPool: [
      {
        title: "Тихий должник",
        brief: "Найди должника на Рынке и аккуратно намекни — возвращать пора.",
        targetType: "talk",
        targetRef: "merchant_holvas",
        rewardSilverHint: 40,
        rewardExpHint: 35,
      },
    ],
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
    personality: "silent_observant",
    motives: "пройти каждый камень перевала и оставить за собой лишь знаки тех, кто здесь был",
    questPool: [
      {
        title: "Метка тропы",
        brief: "Отметь, как далеко ушли мародёры — сними одного дозорного.",
        targetType: "kill",
        targetRef: "ash_marauder",
        targetCount: 1,
        rewardSilverHint: 55,
        rewardExpHint: 90,
      },
    ],
  },
];

export async function seedNpcsIfEmpty(log: Logger): Promise<void> {
  const existing = await db.select().from(npcs);
  const existingMap = new Map(existing.map((e) => [e.id, e]));
  const toInsert = NPC_SEED.filter((n) => !existingMap.has(n.id));
  if (toInsert.length > 0) {
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
        personality: n.personality,
        motives: n.motives,
        questPoolJson: n.questPool,
      })),
    );
    log.info({ inserted: toInsert.length }, "NPC seed: inserted");
  }

  // Backfill personality/motives/questPool for NPCs that existed before P3.
  // Only patches rows where these fields are still default/empty — never
  // overwrites edits made via the admin panel.
  let patched = 0;
  for (const seed of NPC_SEED) {
    const cur = existingMap.get(seed.id);
    if (!cur) continue;
    const needsPatch =
      cur.personality === "neutral" ||
      !cur.motives ||
      !Array.isArray(cur.questPoolJson) ||
      (cur.questPoolJson as unknown[]).length === 0;
    if (!needsPatch) continue;
    await db
      .update(npcs)
      .set({
        personality: seed.personality,
        motives: seed.motives,
        questPoolJson: seed.questPool,
      })
      .where(eq(npcs.id, seed.id));
    patched++;
  }
  if (patched > 0) {
    log.info({ patched }, "NPC seed: backfilled personality/motives/questPool");
  }
}
