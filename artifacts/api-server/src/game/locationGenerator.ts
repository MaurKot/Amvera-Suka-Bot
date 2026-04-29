import { db, locations, worldEvents, type Location } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { ai } from "../lib/gemini";
import type { Logger } from "pino";
import { connectLocations } from "./locationGraph";
import { LOCATIONS } from "./lore";

/**
 * P2 — Procedural location generation.
 *
 * The Master AI may extend the world graph from a "frontier" location.
 * To keep the world coherent we:
 *  1. Always anchor the new location to an existing parent (one new edge only).
 *  2. Generate the new location's id from its name (slugified), ensure no clash.
 *  3. Mark `isGenerated=true` and `isFrontier=true` so it can be extended later.
 *  4. Place the new node near the parent (small angular offset) for the minimap.
 */

const GeneratedLocationSchema = z.object({
  name: z.string().min(2).max(60),
  region: z.string().min(2).max(60),
  description: z.string().min(20).max(400),
  type: z.enum(["wilderness", "ruin", "shrine", "city", "market", "mountain", "swamp", "cave", "forest"]),
  isSafe: z.boolean(),
});

function safeParseJsonBlock(text: string): unknown {
  const trimmed = text.trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = /\{[\s\S]*\}/.exec(trimmed);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function transliterateRu(s: string): string {
  const map: Record<string, string> = {
    а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y",
    к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f",
    х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
  };
  return s
    .toLowerCase()
    .split("")
    .map((ch) => map[ch] ?? ch)
    .join("")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

async function uniqueId(base: string): Promise<string> {
  let candidate = base.slice(0, 32);
  let n = 0;
  while (true) {
    const id = n === 0 ? candidate : `${candidate}_${n}`;
    const [hit] = await db.select({ id: locations.id }).from(locations).where(eq(locations.id, id)).limit(1);
    if (!hit) return id;
    n++;
    if (n > 9) {
      candidate = `${candidate}_${Math.floor(Math.random() * 9999)}`;
      n = 0;
    }
  }
}

function offsetCoords(parent: Location, allLocs: Location[]): { x: number; y: number } {
  // Place the new node on a ring around the parent, picking the angle that's
  // least crowded by sibling neighbors.
  const RADIUS = 0.7;
  const TRIES = 8;
  const candidates: { x: number; y: number; minDist: number }[] = [];
  for (let i = 0; i < TRIES; i++) {
    const angle = (i / TRIES) * Math.PI * 2;
    const x = parent.coordX + Math.cos(angle) * RADIUS;
    const y = parent.coordY + Math.sin(angle) * RADIUS;
    let minDist = Infinity;
    for (const l of allLocs) {
      const dx = l.coordX - x;
      const dy = l.coordY - y;
      minDist = Math.min(minDist, Math.hypot(dx, dy));
    }
    candidates.push({ x, y, minDist });
  }
  candidates.sort((a, b) => b.minDist - a.minDist);
  return { x: candidates[0]!.x, y: candidates[0]!.y };
}

export interface GenerateLocationOptions {
  parentId: string;
  log: Logger;
  triggeredBy?: "ai_cycle" | "admin" | "player";
  hint?: string; // optional thematic hint
}

export interface GenerateLocationResult {
  location: Location;
  parentId: string;
  reason: "ai" | "fallback";
}

const FALLBACK_TEMPLATES: Array<z.infer<typeof GeneratedLocationSchema>> = [
  {
    name: "Тихие Камни",
    region: "Эхо Пепла",
    description:
      "Поляна, где валуны лежат полукругом — будто кто-то сел отдохнуть и не встал. Ветер здесь шепчет старыми именами.",
    type: "wilderness",
    isSafe: false,
  },
  {
    name: "Туманная Низина",
    region: "Двулунные Земли",
    description:
      "Низина, в которой туман не рассеивается даже днём. Слышно, как где-то капает вода в колодец, которого никто не видит.",
    type: "wilderness",
    isSafe: false,
  },
  {
    name: "Заброшенная Кузня",
    region: "Карат",
    description:
      "Старая кузня без хозяина. Молот лежит на наковальне, на котором ещё видна тёплая искра — будто кто-то только что отошёл.",
    type: "ruin",
    isSafe: false,
  },
];

function buildPrompt(parent: Location, hint?: string): string {
  return `Ты — рассказчик мрачного фэнтези мира Альтера. Из локации «${parent.name}» (регион ${parent.region}, тип ${parent.type}) странники находят новую тропу.${hint ? ` Подсказка темы: ${hint}.` : ""}

Опиши соседнюю, ранее не описанную локацию. Никакого упоминания механики, статов, ИИ.

Верни JSON-объект:
{
  "name": "Название из 1–3 слов на русском, в стиле тёмного фэнтези",
  "region": "Один из: Эхо Пепла, Маэранский Тракт, Двулунные Земли, Карат, Эхо Пустоши",
  "description": "1–2 предложения на русском, передающих атмосферу",
  "type": "Один из: wilderness, ruin, shrine, market, mountain, swamp, cave, forest",
  "isSafe": false
}

Никакого текста вне JSON.`;
}

export async function generateAdjacentLocation(opts: GenerateLocationOptions): Promise<GenerateLocationResult | null> {
  const { parentId, log } = opts;
  const [parent] = await db.select().from(locations).where(eq(locations.id, parentId)).limit(1);
  if (!parent) return null;
  if (!parent.isFrontier) {
    log.info({ parentId }, "Location gen: parent is not a frontier, refusing");
    return null;
  }

  const allLocs = await db.select().from(locations);
  if (allLocs.length >= 24) {
    log.info({ count: allLocs.length }, "Location gen: world cap reached");
    return null;
  }

  let payload: z.infer<typeof GeneratedLocationSchema>;
  let reason: "ai" | "fallback" = "ai";
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: buildPrompt(parent, opts.hint) }] }],
      config: { temperature: 0.95, maxOutputTokens: 240 },
    });
    const parsed = GeneratedLocationSchema.safeParse(safeParseJsonBlock(response.text ?? ""));
    if (parsed.success) {
      payload = parsed.data;
    } else {
      log.warn({ problems: parsed.error.issues }, "Location gen: model output rejected, using fallback");
      payload = { ...FALLBACK_TEMPLATES[Math.floor(Math.random() * FALLBACK_TEMPLATES.length)]! };
      reason = "fallback";
    }
  } catch (err) {
    log.warn({ err: (err as Error).message }, "Location gen: Gemini call failed");
    payload = { ...FALLBACK_TEMPLATES[Math.floor(Math.random() * FALLBACK_TEMPLATES.length)]! };
    reason = "fallback";
  }

  // Reserve unique id (don't collide with hand-authored seed ids either)
  const seedIds = new Set(LOCATIONS.map((l) => l.id));
  let baseSlug = transliterateRu(payload.name);
  if (!baseSlug) baseSlug = "wild_path";
  if (seedIds.has(baseSlug)) baseSlug = `${baseSlug}_new`;
  const id = await uniqueId(baseSlug);

  const { x, y } = offsetCoords(parent, allLocs);

  // Insert with parent edge already in connectedTo; then mirror via connectLocations.
  const [inserted] = await db
    .insert(locations)
    .values({
      id,
      name: payload.name,
      region: payload.region,
      description: payload.description,
      type: payload.type,
      isSafe: payload.isSafe,
      isStarter: false,
      connectedTo: [parent.id],
      coordX: x,
      coordY: y,
      isFrontier: true,
      isGenerated: true,
      generatedAt: new Date(),
    })
    .returning();

  await connectLocations(parent.id, id);

  // Reduce parent's frontier-likelihood: only ~1 in 3 of generated nodes
  // remain frontier so the graph doesn't explode.
  if (Math.random() > 0.34) {
    await db.update(locations).set({ isFrontier: false }).where(eq(locations.id, id));
  }

  await db.insert(worldEvents).values({
    eventType: "location_generated",
    actorId: 0,
    targetId: id,
    locationId: parent.id,
    deltaRep: 0,
    narrativeFlag: "location_generated",
    severity: 2,
    isPublic: true,
    description: `За «${parent.name}» открылась новая тропа — «${payload.name}». [${reason === "ai" ? "ИИ" : "запасной шаблон"}]`,
  });

  log.info({ parentId, newId: id, reason }, "Location gen: created");
  return { location: inserted!, parentId, reason };
}
