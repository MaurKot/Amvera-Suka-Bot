export type RepBehavior =
  | "kill_on_sight"
  | "refuse_all"
  | "aggressive_proximity"
  | "hostile_2x_price"
  | "refuse_quests"
  | "cold_no_trade"
  | "standard"
  | "friendly"
  | "trust"
  | "admiration"
  | "worship"
  | "blind_faith"
  | "absolute_devotion";

export interface RepLevel {
  nameRu: string;
  nameEn: string;
  icon: string;
  behavior: RepBehavior;
}

export function getRepLevel(rep: number): RepLevel {
  if (rep <= -1601) return { nameRu: "Список смерти", nameEn: "Death List", icon: "skull", behavior: "kill_on_sight" };
  if (rep === -1600) return { nameRu: "Непримиримая вражда", nameEn: "Irreconcilable", icon: "skull", behavior: "refuse_all" };
  if (rep >= -1599 && rep <= -800) return { nameRu: "Ненависть", nameEn: "Hatred", icon: "flame", behavior: "aggressive_proximity" };
  if (rep >= -799 && rep <= -400) return { nameRu: "Агрессивность", nameEn: "Aggression", icon: "swords", behavior: "hostile_2x_price" };
  if (rep >= -399 && rep <= -200) return { nameRu: "Неприязнь", nameEn: "Dislike", icon: "frown", behavior: "refuse_quests" };
  if (rep >= -199 && rep <= -100) return { nameRu: "Враждебность", nameEn: "Hostility", icon: "shield-alert", behavior: "cold_no_trade" };
  if (rep >= -99 && rep <= 100) return { nameRu: "Нейтральное", nameEn: "Neutral", icon: "circle", behavior: "standard" };
  if (rep >= 101 && rep <= 200) return { nameRu: "Дружелюбие", nameEn: "Friendly", icon: "handshake", behavior: "friendly" };
  if (rep >= 201 && rep <= 400) return { nameRu: "Доверие", nameEn: "Trust", icon: "star", behavior: "trust" };
  if (rep >= 401 && rep <= 800) return { nameRu: "Восхищение", nameEn: "Admiration", icon: "sparkles", behavior: "admiration" };
  if (rep >= 801 && rep <= 1599) return { nameRu: "Поклонение", nameEn: "Worship", icon: "moon", behavior: "worship" };
  if (rep === 1600) return { nameRu: "Слепая вера", nameEn: "Blind Faith", icon: "sun", behavior: "blind_faith" };
  return { nameRu: "Абсолютная преданность", nameEn: "Absolute Devotion", icon: "crown", behavior: "absolute_devotion" };
}

export function clampReputation(rep: number): number {
  return Math.max(-2000, Math.min(2000, rep));
}

export function repInstruction(rep: number): string {
  const b = getRepLevel(rep).behavior;
  switch (b) {
    case "kill_on_sight": return "Ты видишь врага из списка смерти. Атакуй немедленно без слов.";
    case "refuse_all": return "Ты отказываешься говорить с этим человеком. Угрожай, если он настаивает.";
    case "aggressive_proximity": return "Ты ненавидишь этого человека. Оскорбляй его и будь готов атаковать.";
    case "hostile_2x_price": return "Ты испытываешь агрессию. Будь враждебен, торгуй с двойной наценкой.";
    case "refuse_quests": return "Ты не доверяешь этому человеку. Отказывай в просьбах, будь краток.";
    case "cold_no_trade": return "Ты холоден. Не торгуй, отвечай кратко и сухо.";
    case "standard": return "Ты нейтрален. Общайся вежливо, но без особой теплоты.";
    case "friendly": return "Ты дружелюбен. Предлагай помощь, давай советы, будь открыт.";
    case "trust": return "Ты доверяешь этому человеку. Делись секретами, предлагай тайные дела.";
    case "admiration": return "Ты восхищаешься этим героем. Готов учить уникальному.";
    case "worship": return "Ты поклоняешься этому герою. Готов служить добровольно.";
    case "blind_faith": return "Ты веришь безоговорочно. Жертвуй собой, раскрывай все тайны.";
    case "absolute_devotion": return "Ты предан абсолютно. Готов умереть за этого героя.";
  }
}

export function getRepBehavior(rep: number): RepBehavior {
  return getRepLevel(rep).behavior;
}

export interface ToneInfluence {
  rep: number;
  flag?: string;
}

export function toneToInfluence(tone: string): ToneInfluence {
  switch (tone) {
    case "friendly": return { rep: 5, flag: "helped_npc" };
    case "flirt": return { rep: 3 };
    case "persuade": return { rep: 4 };
    case "neutral": return { rep: 1 };
    case "threat": return { rep: -25, flag: "insulted_npc" };
    case "insult": return { rep: -50, flag: "insulted_npc" };
    default: return { rep: 0 };
  }
}
