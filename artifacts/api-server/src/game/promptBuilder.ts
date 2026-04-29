import { getRepLevel, repInstruction } from "./reputation";
import { LEDGER_EVENTS } from "./events";
import type { NPC } from "@workspace/db";

export interface PromptInputs {
  npc: NPC;
  characterName: string;
  characterRace: string;
  characterClass: string;
  reputation: number;
  recentFlags: string[];
  tone: string;
  playerMessage: string;
  history: { role: string; content: string }[];
}

const TONE_HINT: Record<string, string> = {
  neutral: "нейтрально, без эмоций",
  friendly: "дружелюбно и тепло",
  flirt: "с лёгким флиртом, играя словами",
  threat: "с угрозой, давит и пугает",
  insult: "оскорбительно, презрительно",
  persuade: "пытается убедить, использует логику и уговоры",
};

export function buildSystemPrompt(input: PromptInputs): string {
  const lore =
    input.npc.tier === 1 ? input.npc.fullLore ?? input.npc.shortProfile : input.npc.shortProfile;

  const facts = input.recentFlags
    .slice(0, 8)
    .map((flag) => LEDGER_EVENTS[flag]?.flagText)
    .filter(Boolean) as string[];

  const factsBlock =
    facts.length > 0
      ? `\nИЗВЕСТНЫЕ ФАКТЫ О СОБЕСЕДНИКЕ:\n${facts.map((f) => `• ${f}`).join("\n")}`
      : "";

  const rep = getRepLevel(input.reputation);

  const historyBlock =
    input.history.length > 0
      ? `\n\nПОСЛЕДНИЕ РЕПЛИКИ ДИАЛОГА:\n${input.history
          .slice(-6)
          .map((m) => (m.role === "player" ? `Игрок: ${m.content}` : `Ты: ${m.content}`))
          .join("\n")}`
      : "";

  const titleLine = input.npc.title ? ` (${input.npc.title})` : "";
  const toneText = TONE_HINT[input.tone] ?? "нейтрально";

  return `Ты — ${input.npc.name}${titleLine}. ${lore}

ГОЛОС: ${input.npc.voiceStyle}
ЗНАНИЯ: ${input.npc.knownFacts}

СОБЕСЕДНИК: ${input.characterName}, ${input.characterRace}, ${input.characterClass}.
ОТНОШЕНИЕ К СОБЕСЕДНИКУ: ${rep.nameRu} (${input.reputation}). ${repInstruction(input.reputation)}${factsBlock}

ТОН РЕПЛИКИ ИГРОКА: ${toneText}.${historyBlock}

ПРАВИЛА ОТВЕТА:
1. Отвечай ТОЛЬКО на русском языке.
2. 1–3 предложения, в характере персонажа.
3. Не упоминай игровые механики, статы, очки, уровни, ИИ, нейросети.
4. Реагируй на тон игрока и факты из памяти мира, если они есть.
5. Не пиши «Игрок:» или «Ты:» в ответе. Только реплику персонажа, без префиксов.
6. Не используй эмодзи.

Игрок говорит: «${input.playerMessage}»

Твой ответ:`;
}
