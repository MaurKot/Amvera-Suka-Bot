import { z } from "zod";
import type { ContextAnchor } from "./anchor";

/** L1 — Strict shape of a single NPC reply line. */
export const NpcReplySchema = z.object({
  reply: z.string().trim().min(1).max(800),
  emotion: z.enum(["calm", "warm", "cold", "angry", "fear", "amused", "wary"]).optional(),
});
export type NpcReply = z.infer<typeof NpcReplySchema>;

/** L3 — Forbidden-fact validator. Rejects/cleans replies referencing
 * locations, NPCs or items that the world doesn't know about. */
export interface ValidationResult {
  ok: boolean;
  cleaned: string;
  problems: string[];
}

const KNOWN_NEUTRAL_PLACE_TOKENS = new Set([
  "город",
  "деревня",
  "лес",
  "ущелье",
  "дом",
  "храм",
  "трактир",
  "рынок",
  "святилище",
  "перевал",
  "руины",
  "башня",
]);

const PLACE_PATTERN = /(?:в|на|к|у|из|до)\s+([А-ЯЁ][а-яё]{2,})(\s+[А-ЯЁ][а-яё]{2,}){0,2}/g;
const PROPER_NAME_PATTERN = /\b([А-ЯЁ][а-яё]{3,})\b/g;

function tokenize(text: string): string[] {
  return text.toLowerCase().split(/[^а-яёa-z0-9]+/).filter(Boolean);
}

function knownNamesFromAnchor(anchor: ContextAnchor): Set<string> {
  const names = new Set<string>();
  for (const l of anchor.knownLocations) {
    for (const tok of tokenize(l.name)) names.add(tok);
  }
  for (const n of anchor.knownNpcs) {
    for (const tok of tokenize(n.name)) names.add(tok);
  }
  for (const e of anchor.knownEnemies) {
    for (const tok of tokenize(e.name)) names.add(tok);
  }
  for (const tok of tokenize(anchor.characterName)) names.add(tok);
  // Names of races/regions are baked into the lore module — keep a small allow list.
  ["альтера", "ардаэн", "велхари", "сахваки", "сирет", "маэран", "альвенори", "торнвуд", "карат", "хадрани", "люменар", "эхо", "пепла", "пустоши", "тракт", "клык", "лощина"].forEach((t) => names.add(t));
  return names;
}

/** Heuristic: flag obvious invented proper nouns referencing places/people not in world.
 *  Returns ok=true if nothing suspicious; otherwise returns problems list (non-blocking). */
export function validateNarrative(
  text: string,
  anchor: ContextAnchor,
): ValidationResult {
  const known = knownNamesFromAnchor(anchor);
  const problems: string[] = [];

  let m: RegExpExecArray | null;
  const seen = new Set<string>();
  while ((m = PLACE_PATTERN.exec(text))) {
    const phrase = m[1].toLowerCase();
    if (seen.has(phrase)) continue;
    seen.add(phrase);
    if (KNOWN_NEUTRAL_PLACE_TOKENS.has(phrase)) continue;
    if (known.has(phrase)) continue;
    problems.push(`unknown_place:${phrase}`);
  }

  const seenName = new Set<string>();
  while ((m = PROPER_NAME_PATTERN.exec(text))) {
    const name = m[1].toLowerCase();
    if (seenName.has(name)) continue;
    seenName.add(name);
    if (known.has(name)) continue;
    if (KNOWN_NEUTRAL_PLACE_TOKENS.has(name)) continue;
    // Skip very common Russian sentence starters that begin uppercase
    if (["он", "она", "они", "это", "эти", "тот", "та", "те", "так", "что", "как", "если", "когда", "почему"].includes(name)) continue;
    problems.push(`unknown_name:${name}`);
  }

  let cleaned = text.trim();
  // L3 mitigation: if too many invented names, trim to a generic safe reply
  if (problems.length >= 4) {
    cleaned = cleaned
      .replace(/[«»"]/g, "")
      .split(/[.!?]/)
      .filter((s) => s.trim().length > 0)
      .slice(0, 1)
      .join(". ")
      .trim();
    if (!cleaned) cleaned = "Я молчу. Слова сейчас лишние.";
    cleaned += ".";
  }

  return { ok: problems.length === 0, cleaned, problems };
}
