# Altera: Echoes of Fate — Audit Implementation Notes

This document captures the architectural changes made during the major audit of
**Altera: Echoes of Fate** (Russian-language dark-fantasy MMORPG Telegram Mini
App with Gemini-driven NPCs). It is meant for developers picking up the
codebase. UI strings remain in Russian.

The work is organised by the six numbered priorities (P1–P6).

## Layout

```
artifacts/
  altera/        # Telegram Mini App (Vite + React + Tailwind v4 + wouter)
  api-server/    # Express + Drizzle ORM, talks to Gemini via @google/genai
lib/
  db/            # Drizzle schema + pool — the only place the DB shape lives
  api-zod/       # zod request/response schemas shared by both sides
  api-client-react/ # codegen'd react-query hooks (existing endpoints)
```

For the new endpoints introduced in this audit we use a hand-written client
(`artifacts/altera/src/lib/api.ts`) rather than re-running orval — they were
faster to ship and tightly tied to brand-new shapes.

---

## P1 — UI / text readability

**Files**: `artifacts/altera/src/index.css`

- Lifted `--foreground` from `36 33% 85%` to `36 38% 92%`, `--muted-foreground`
  from `65%` to `78%`, and brightened `--primary` from `43 44% 50%` to
  `43 70% 62%` so it is no longer too dim against the obsidian background.
  Both new pairs clear WCAG AA against `--background: 240 10% 4%`.
- Added three CSS variables for legible text shadows:
  `--text-shadow-fantasy`, `--text-shadow-fantasy-strong`,
  `--text-shadow-glow-gold`.
- Set `body { font-weight: 500 }` (was 400) and `h1..h6 { font-weight: 600 }`
  so type stays sharp on dark backgrounds.
- Added base-layer rules that apply the soft shadow to inline copy and the
  strong shadow + gold glow to top-level headings.
- Added utilities `.no-shadow`, `.text-fantasy-strong`, `.text-fantasy-glow`
  for situations where the default shadow would look muddy (badges, code
  blocks, JSON dumps in admin).

---

## P2 — Location graph + procedural generation

**Schema** (`lib/db/src/schema/game.ts` — extends `locations`):
- `connectedTo: jsonb<string[]>` — adjacency list (graph edges).
- `coordX / coordY: integer` (0..100) for the SVG mini-map.
- `isFrontier`, `isGenerated`, `generatedAt` for the procedural layer.

**Backend**:
- `artifacts/api-server/src/game/locationGraph.ts` — pure helpers: BFS, edge
  insertion, neighbour lookup, frontier picker.
- `artifacts/api-server/src/game/locationGenerator.ts` — `generateAdjacentLocation`:
  asks Gemini (`gemini-2.5-flash`, `temperature 0.95`, ≤240 tokens) for a new
  Russian-flavoured location grounded in its parent's `region`, falls back to a
  curated `FALLBACK_TEMPLATES` array if the model is unavailable or the JSON is
  malformed. Hand-rolls a unique slug via transliteration. Caps total locations
  at 24.
- `artifacts/api-server/src/game/locationService.ts` — `visitLocation` now
  enforces `current.connectedTo.includes(target)` and throws
  `LocationNotConnectedError`.
- `routes/location.ts` — `GET /locations` returns `connectedTo`, coords,
  `isReachable`, `isFrontier`, `isGenerated`, `activeEvents`. New
  `POST /locations/generate { fromLocationId, hint? }` lets a player extend the
  world from where they stand (rate-limited via the `world_events` table —
  one player-triggered expansion every 30 minutes, world-wide).

**Frontend** (`artifacts/altera/src/pages/map.tsx`):
- Replaced the flat list with an SVG mini-map using `coordX/Y` to position
  nodes and `connectedTo` to draw edges. Pulsing ring on the player, dashed
  ring on reachable neighbours, red dot on locations carrying an active event.
- "Шагнуть за горизонт" button calls `POST /locations/generate`.
- Visit is now gated on `isReachable`; the Telegram MainButton shows
  "Слишком далеко — нет тропы" otherwise.

---

## P3 — NPCs (personality / motives / AI quest generation)

**Schema** (`lib/db/src/schema/game.ts`):
- `npcs.personality: text NOT NULL DEFAULT 'neutral'`
- `npcs.motives: text` (free-form Russian)
- `npcs.questPoolJson: jsonb` (curated quest seeds the AI may draw from)
- New `npcMemory` table — one row per `(npcId, characterId)`, carrying free-form
  memory the NPC keeps about that player (used to make subsequent dialogues
  feel continuous).
- New `generatedQuests` table — AI-authored quests with status
  `available | accepted | declined | completed | failed`, target metadata,
  reward fields.

**Backend**:
- `artifacts/api-server/src/game/questGenerator.ts` — `generateQuestForNpc`:
  builds a prompt from the NPC's personality, motives, location, faction,
  questPool, and the player's current state; asks Gemini for a JSON quest;
  validates with zod; falls back to a sampled questPool entry on failure.
- `routes/generatedQuest.ts` — `GET /quests/generated`,
  `POST /npc/:npcId/quest/generate`, `POST /quests/generated/:id/status`.
- `npcSeed.ts` — all 10 hand-authored NPCs got `personality`, `motives` and a
  questPool. Existing rows where `personality = 'neutral'` are back-filled.

**Frontend** (`artifacts/altera/src/components/npc-dialog.tsx`):
- Added a "Спросить про дело" button. Clicking it calls `POST
  /npc/:npcId/quest/generate` and reveals an in-dialog preview with title,
  description, objective, rewards, and Берусь / Откажусь buttons that PATCH
  the quest's status.

---

## P4 — Dual AI architecture (Master AI cycle)

**Schema**:
- `aiCycles` — every Master AI invocation records `cycleKind`, `status`,
  `notesJson`, `errorText`, timing.
- `activeWorldEvents` — currently-running world events spawned by the cycle
  (or by an admin).

**Backend** (`artifacts/api-server/src/game/worldDirector.ts`):
- `runWorldCycle({ triggeredBy, log })` — single Gemini call (`gemini-2.5-flash`,
  `temperature 0.6`) given a world snapshot (recent events, recently-active
  characters, frontier locations, recent flagged dialogues). The model returns
  a JSON action plan; we execute it under tight caps: at most **1** new
  location and **1** new world event per cycle. Everything is wrapped in a
  single transaction; failures are recorded in `aiCycles.errorText` and never
  bring the server down.
- `startWorldDirectorScheduler()` — wired in `index.ts`, runs every
  `WORLD_CYCLE_INTERVAL_MS` (default `21_600_000` / 6h) when
  `WORLD_CYCLE_ENABLED !== "false"`.
- The "tick" Gemini AI behind in-game NPC dialogue is unchanged.

---

## P5 — Admin panel (`/admin`, token-protected)

**Backend** (`artifacts/api-server/src/middlewares/admin.ts`,
`artifacts/api-server/src/routes/admin.ts`):
- `adminAuth` middleware — constant-time comparison against
  `process.env.ADMIN_TOKEN` (must be ≥ 8 chars; returns `503` if the env var
  is missing). Header is `x-admin-token: <secret>`. Only the **last 6 chars**
  of the token are persisted to `adminLog` so the audit trail can identify
  which key was used without leaking it.
- Routes (all gated, all logged):
  - `GET /admin/overview` — counts of characters, NPCs, locations, active
    events, AI cycles, generated quests, banned players.
  - `GET /admin/npcs`, `PATCH /admin/npcs/:id` — view + edit profile,
    voice, personality, motives, hostility.
  - `GET /admin/locations`, `PATCH /admin/locations/:id`,
    `POST /admin/locations/generate` — curate + admin-trigger generation.
  - `GET /admin/events/active`, `POST /admin/events`,
    `POST /admin/events/:id/end` — manually run a world event.
  - `GET /admin/ai-cycles`, `POST /admin/ai-cycles/run` — synchronously
    trigger a Master AI tick (great for debugging).
  - `GET /admin/players`, `POST /admin/players/:id/moderation` — warn /
    mute / ban (writes through `playerModeration`).
  - `GET /admin/audit-log` — latest 100 admin actions.
  - `GET /admin/generated-quests` — recent AI quests for inspection.

**Frontend** (`artifacts/altera/src/pages/admin.tsx`, route `/admin` in
`App.tsx`):
- Token-gate (input only, never persisted to disk; sessionStorage only).
- Tabs: Свод · NPC · Места · События · Циклы AI · Игроки · Журнал.
- Layout uses `hideNav` to hide the bottom navigation in the admin shell.
- Every API call uses the typed `adminRequest` helper from
  `lib/api.ts` which adds `x-admin-token` and translates `401 / 503` into
  Russian-language error messages.

---

## P6 — Dynamic world events

- `activeWorldEvents` rows are emitted by the Master AI cycle, by the admin
  panel, or as side-effects of game actions (e.g. a frontier exploration fires
  a `frontier_explore` event used as a soft rate-limit).
- `GET /locations` joins active events so each `LocationDTO` carries an
  `activeEvents: { title, severity, eventKind }[]` array.
- The map's mini-map paints a red dot on locations carrying an event.
- The shared `Layout` shows a banner at the top of every page when the
  player's current location has an active event (severity-tinted).

---

## Migrations & seed

- `artifacts/api-server/src/lib/migrations.ts` runs at startup. It is
  **idempotent**: `ALTER TABLE … ADD COLUMN IF NOT EXISTS …` for every new
  column, `CREATE TABLE IF NOT EXISTS` for every new table, with a small
  ad-hoc backfill (e.g. setting `personality` on existing NPCs).
- `pnpm --filter @workspace/db run push` is still the canonical way to apply
  schema for fresh databases — startup migrations only handle deltas.

## Environment variables

| Var | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres (already required) |
| `GOOGLE_API_KEY` | Gemini access (already required for NPC dialogue) |
| `ADMIN_TOKEN` | ≥ 8 chars; required to use `/admin` |
| `WORLD_CYCLE_ENABLED` | Set to `"false"` to disable the Master AI scheduler |
| `WORLD_CYCLE_INTERVAL_MS` | Default `21_600_000` (6 hours) |

## Adding a new admin endpoint

1. Add the route in `routes/admin.ts` (it is automatically gated by
   `adminAuth` because `router.use(adminAuth)` is at the top).
2. Call `await logAdminAction(req.adminTokenLast6 ?? "?", action, kind, id, details)`.
3. Add a typed helper in `artifacts/altera/src/lib/api.ts` that uses
   `adminRequest`.
4. Wire it into a pane in `artifacts/altera/src/pages/admin.tsx`.

## Adding a new dynamic event type

1. Insert a row into `activeWorldEvents` with a unique `slug`,
   `eventKind`, `severity`, and an `affectedLocationsJson` array (or `[]` for
   world-wide).
2. The map and Layout banner pick it up automatically.
3. To make it influence dialogue or quest generation, read it inside
   `promptBuilder.ts` / `questGenerator.ts` and append a snippet to the
   system prompt.
