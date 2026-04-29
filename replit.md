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

- Workflow «Start application» запускает `scripts/dev.sh`, который параллельно поднимает Express (`PORT=8080`, `NODE_ENV=development`) и Vite (`PORT=5000`, `BASE_PATH=/`).
- В dev все `/api/*` запросы фронтенда проксируются Vite на `http://127.0.0.1:8080` (см. `artifacts/altera/vite.config.ts`, переменная `API_PROXY_TARGET`).
- `lib/gemini.ts` инициализируется лениво — отсутствие `GOOGLE_API_KEY` не валит сервер на старте, ошибка возникает только при фактическом обращении к Gemini.

## Переменные окружения (production)

- `DATABASE_URL` — Postgres.
- `SESSION_SECRET` — подпись сессий.
- `GOOGLE_API_KEY` — собственный ключ Gemini (без прокси).
- `TELEGRAM_BOT_TOKEN` — для HMAC-валидации `initData`.
- `PORT` — порт HTTP (по умолчанию `8080`).
- `NODE_ENV=production` — включает раздачу статики из `./public`.

## Деплой на Amvera Cloud

- `Dockerfile` — multi-stage: builder (pnpm install + vite build + esbuild) → runtime (node:22-alpine + `dist` + `public`).
- `amvera.yml` — конфиг Amvera (containerPort 8080, переменные окружения).
- `.dockerignore` — исключает `node_modules`, `dist`, `attached_assets`, `.git`.
- В рантайме API и фронтенд работают как единый сервис на одном порту: `/api/*` → Express-роутер, всё остальное → SPA-fallback на `index.html`.
