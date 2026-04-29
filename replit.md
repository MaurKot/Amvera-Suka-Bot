# Altera: Echoes of Fate

Тёмное фэнтези-MMORPG как Telegram Mini App с живыми NPC на базе Gemini AI. Мир помнит каждое решение игрока — через систему Хроник (`worldEvents`), репутации (-2000..+2000) и нарративных флагов.

## Архитектура

Монорепо на pnpm + TypeScript.

### Артефакты
- `artifacts/altera` — React + Vite фронтенд (мобильный TMA-интерфейс).
- `artifacts/api-server` — Express + Drizzle бекенд (`/api`). В production он же раздаёт собранный фронтенд из `./public` и работает как единый контейнер.
- `artifacts/mockup-sandbox` — sandbox для прототипов UI.

### Общие библиотеки
- `lib/db` — Drizzle схема (Postgres).
  Таблицы: `characters` (+ telegramId, telegramUsername, referralCode, referredBy), `npcs`, `npcDialogues`, `characterReputation`, `worldEvents`, `battles`, `inventoryItems`, `locations`, `factions`, `quests`, `characterQuests`, `achievements`, `characterAchievements` (+ `expiresAt` для временных баффов), `bestiary`, `referrals`.
- `lib/api-spec` — OpenAPI контракт.
- `lib/api-zod`, `lib/api-client-react` — сгенерированный Zod / React Query слой по OpenAPI.
- Новые ручные клиенты в `artifacts/altera/src/lib/api.ts` для эндпойнтов, добавленных в этой итерации (locations/quests/achievements/referral/bestiary) — без перегенерации orval.

## Игровая модель: Три Закона

1. **LLM — это голос.** Gemini генерирует только текст реплики NPC.
2. **TypeScript — это законы.** Все цифры (репутация, урон, награды, флаги) считает сервер.
3. **Мир помнит.** Каждое значимое действие пишется в `worldEvents` с `narrativeFlag`. NPC видит флаги в промпте → последствия неотвратимы.

## Защита от галлюцинаций (3 уровня)

1. **Контекст-якорь.** `game/anchor.ts` собирает «World Anchor Snapshot» (репутации, фракции, флаги, текущие квесты, недавние Хроники) и кладёт системный промпт перед каждым вызовом Gemini.
2. **Zod-схема ответа.** `game/validator.ts` валидирует JSON-ответ модели через `NpcReplySchema` (поля: `text`, `tone`, `repHint`, `flagSuggestions`, `mentionedEntities`).
3. **Нарративный валидатор.** Тот же `validateNarrative` ловит запрещённые элементы (упоминания несуществующих локаций/NPC/предметов, лом канона, повышение репутации без оснований). При нарушении ответ не сохраняется и заменяется fallback-фразой; репутация и флаги корректируются сервером.

## World Anchor (стартовый сид)

`game/worldSeed.ts` идемпотентно вставляет:
- **6 локаций**, включая 3 стартовых; флаги `isSafe/isStarter`.
- **10 фракций**; репутация по умолчанию 0, кроме `cult_pale_god` (=-200, исконный враг).
- **5 стартовых квестов** разных типов (talk, kill, deliver, explore, gather) с `objectives` и `rewards`.
- **4 ачивки**, в т.ч. `first_discoverer` с буффом «Аура открытия» на 6 ч (+5 к репутации соседних фракций, +15% дроп).
- **5 записей бестиария** для первичной встречи (race-safe фиксация первооткрывателя).
- **10 NPC** с `voiceStyle`/`knownFacts` для промпта Gemini.

## Игровая модель TMA

- Нижняя навигация: **Главная / Карта / Персонаж / Инвентарь** (видна только при наличии персонажа).
- На «Главной» — плитки в дополнительные разделы: Дела, Награды, Друзья, Хроника.
- **Карта** (`/map`): список локаций с пометками «Здесь / Открыто / Не открыто», именем первооткрывателя; `MainButton` появляется при выборе локации и подтверждает «Посетить». Race-safe вставка `discoveredBy` через `INSERT … ON CONFLICT DO NOTHING`.
- **Диалог с NPC** (`components/npc-dialog.tsx`): модалка с тонами реплик (Дружелюбно/Нейтрально/Убедить/Угрожать/Оскорбить); haptic при отправке/успехе/ошибке; репутация и флаги обновляются сервером.
- **SSE realtime**: `GET /api/events` транслирует `location_discovered`, `character_entered/left`, `npc_dialogue`, `narrative_flag`, `quest_*` через Postgres `LISTEN/NOTIFY`. Клиентский хук `useRealtimeEvents` авто-переподключается с экспоненциальным бэкоффом.
- **Telegram WebApp**: `lib/telegram.ts` подгружает скрипт TMA, мирится с темой (CSS-переменные `--tg-*`), обёртки `useMainButton/useBackButton/haptic`, патчит `fetch` для авто-внедрения заголовка `X-Telegram-Init-Data` на все `/api/*`-запросы.

## Аутентификация

- Сервер валидирует `initData` в `lib/telegram.ts` (HMAC-SHA256 по схеме Telegram). При корректном — сессия привязывается к `tg_<userId>`. При невалидном — 401.
- Fallback вне Telegram: куки `altera_sid` (HTTP-only, 1 год) — для разработки и web-режима.

## Рефералы

- Каждому персонажу выдаётся короткий `referralCode`.
- `POST /api/referral/redeem` принимает чужой код один раз (защита от self-referral). Награды: 100 серебра пригласившему, 50 — приглашённому.

## Ключевые скрипты

- `bash scripts/dev.sh` — локальный dev: api-server на `:8080` + Vite (altera) на `:5000` с прокси `/api → 8080`. Это и есть workflow «Start application».
- `pnpm run typecheck` — проверка типов всего workspace.
- `pnpm --filter @workspace/db run push` — drizzle push (создание/синхронизация схем).
- `pnpm --filter @workspace/api-spec run codegen` — регенерация Zod / React Query из OpenAPI (если правится `openapi.yaml`).

## Dev-режим в Replit

- Workflow `artifacts/altera: web` запускает Vite (`PORT=18138`, `BASE_PATH=/`).
- Workflow `artifacts/api-server: API Server` запускает Express (`PORT=8080`, `NODE_ENV=development`).
- Workflow `artifacts/mockup-sandbox: Component Preview Server` — для design-песочницы (по требованию).
- Старый монолитный workflow «Start application» (запускал `scripts/dev.sh`) удалён — управление поручено артефактным workflow'ам, которые регистрируются автоматически по структуре `artifacts/*`.
- В dev все `/api/*` запросы фронтенда проксируются Vite на `http://127.0.0.1:8080` (см. `artifacts/altera/vite.config.ts`, переменная `API_PROXY_TARGET`).
- `lib/gemini.ts` инициализируется лениво — отсутствие `GOOGLE_API_KEY` не валит сервер на старте, ошибка возникает только при фактическом обращении к Gemini.

## Мобильная оптимизация и торговля (апрель 2026)

- `artifacts/altera/index.html`: viewport `viewport-fit=cover`, отключён pinch-zoom, `theme-color`.
- `artifacts/altera/src/index.css`: `overscroll-behavior:none`, отключение tap-highlight, инпуты с font-size `16px` на ≤640px (защита от авто-зума iOS), убран user-select на кнопках.
- Все основные страницы переписаны под mobile-first: `home.tsx` (создание персонажа в одну колонку + липкая CTA, хаб действий 2×N), `world.tsx` (NPC-карточки 64px hit-target, прямой запуск боя по кнопке «В бой»), `battle.tsx` (HP-карточки в две колонки, лог 40-55 dvh, 2×2 действия), `npc-dialog.tsx` (full-screen sheet на мобильном, классический Dialog на ≥640px, явная кнопка X).
- Торговля: `artifacts/api-server/src/game/shopCatalog.ts` (каталоги для `merchant_holvas`, `smith_durran`, `tavernkeep_maira`), эндпоинты `GET /api/npc/:id/shop` и `POST /api/npc/:id/shop/buy` в `routes/npc.ts`. Стэкуемые предметы автоматически объединяются в инвентаре, +2 репутации за покупку, событие `shop_purchase` в `worldEvents`.
- NPC-диалог: вкладки «Разговор / Лавка» появляются автоматически для ролей `merchant`, `smith`, `tavern_keeper` (`isMerchantRole`).
- `artifacts/api-server/src/game/npcFallback.ts`: шаблонный ответ NPC при недоступности Gemini — учитывает роль, тон, репутацию и ключевые слова сообщения, чтобы реплики не превращались в «молча смотрит».

## Переменные окружения (production)

- `DATABASE_URL` — Postgres.
- `SESSION_SECRET` — подпись сессий.
- `GOOGLE_API_KEY` — собственный ключ Gemini (без прокси).
- `TELEGRAM_BOT_TOKEN` — для HMAC-валидации `initData`.
- `PORT` — порт HTTP (по умолчанию `8080`).
- `NODE_ENV=production` — включает раздачу статики из `./public`.

## Большой аудит (апрель 2026) — P1..P6

Подробности в `IMPLEMENTATION.md`. Кратко:

- **P1 — читаемость**: повышены `--foreground`/`--muted-foreground`/`--primary`,
  `body` теперь `font-weight:500`, заголовки 600; CSS-переменные и базовые
  правила тёмных текст-теней (`--text-shadow-fantasy*`, `.text-fantasy-strong`,
  `.no-shadow`, `.event-sev-1/2/3`).
- **P2 — граф локаций + процедурка**: `locations` обзавелась `connectedTo`,
  `coordX/Y`, `isFrontier`, `isGenerated`, `generatedAt`; `visitLocation`
  проверяет смежность; `POST /api/locations/generate` (Gemini + fallback).
  В клиенте — SVG-миникарта и кнопка «Шагнуть за горизонт».
- **P3 — NPC + AI-квесты**: `npcs` получили `personality`, `motives`,
  `questPoolJson`; новые таблицы `npc_memory` и `generated_quests`;
  `POST /api/npc/:npcId/quest/generate` и `POST /api/quests/generated/:id/status`;
  в `NpcDialog` — кнопка «Спросить про дело» с превью награды и Берусь/Откажусь.
- **P4 — Master AI**: `worldDirector.ts` запускает «дирижёра» каждые 6 часов
  (`WORLD_CYCLE_INTERVAL_MS`), с лимитом 1 локация + 1 событие за цикл; всё
  пишется в `ai_cycles` (статус, заметки, ошибки) и не валит сервер при сбое.
- **P5 — админка `/admin`**: `ADMIN_TOKEN` (≥8 симв), middleware с
  constant-time проверкой и аудит-логом (только последние 6 символов токена);
  7 разделов на фронте — Свод/NPC/Места/События/Циклы AI/Игроки/Журнал; токен
  хранится только в `sessionStorage`.
- **P6 — динамические события**: `active_world_events` отображаются в
  `LocationDTO.activeEvents`, на миникарте красной точкой и баннером в
  `Layout` для текущей локации игрока (цвет по `severity`).

Новые env-vars: `ADMIN_TOKEN` (обязателен для `/admin`),
`WORLD_CYCLE_ENABLED`, `WORLD_CYCLE_INTERVAL_MS`.

## Деплой на Amvera Cloud

- `Dockerfile` — multi-stage: builder (pnpm install + vite build + esbuild) → runtime (node:22-alpine + `dist` + `public`).
- `amvera.yml` — конфиг Amvera (containerPort 8080, переменные окружения).
- `.dockerignore` — исключает `node_modules`, `dist`, `attached_assets`, `.git`.
- В рантайме API и фронтенд работают как единый сервис на одном порту: `/api/*` → Express-роутер, всё остальное → SPA-fallback на `index.html`.
