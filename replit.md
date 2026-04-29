# Altera: Echoes of Fate

Тёмное фэнтези-MMORPG с живыми NPC на базе Gemini AI. Мир помнит каждое решение игрока — через систему Хроник (ledger), репутации (-2000..+2000) и нарративных флагов.

## Архитектура

Монорепо на pnpm + TypeScript.

### Артефакты
- `artifacts/altera` — React + Vite фронтенд игры (по пути `/`).
- `artifacts/api-server` — Express + Drizzle бекенд игры (по пути `/api`).
- `artifacts/mockup-sandbox` — sandbox для прототипов UI.

### Общие библиотеки
- `lib/db` — Drizzle схема (Postgres). Таблицы: `characters`, `npcs`, `npcDialogues`, `characterReputation`, `worldEvents` (Хроники), `battles`, `inventoryItems`.
- `lib/api-spec` — OpenAPI контракт.
- `lib/api-zod` — сгенерированные Zod-схемы и константы (`SendDialogueBody`, `CreateCharacterBody`, и т.д.).
- `lib/api-client-react` — сгенерированные React Query хуки (`useGetCharacter`, `useSendDialogue`, и т.д.).
- `lib/integrations-gemini-ai` — Gemini SDK через прокси Replit AI Integrations.

## Игровая модель: Три Закона

1. **LLM — это голос.** Gemini генерирует только текст реплики NPC.
2. **TypeScript — это законы.** Все цифры (репутация, урон, награда, флаги) считает сервер.
3. **Мир помнит.** Каждое значимое действие пишется в `worldEvents` с `narrativeFlag`. NPC видит флаги в промпте → последствия неотвратимы.

## Игровой контент

- **10 рас** (Ардаэн, Велхари, Сирн, и т.д.) с бонусами к статам.
- **6 классов** (Воин Эха, Плетущий Руны, и т.д.) с уникальными ресурсами.
- **6 локаций** (Площадь Ардвейла, Лес Шёпотов, Кузница Эха, и т.д.).
- **5 типов врагов** с привязкой к локациям.
- **7 NPC** в стартовых локациях, у каждого — `voiceStyle` и `knownFacts` для промпта.

## Ключевые скрипты

- `pnpm run typecheck` — проверка типов всего workspace.
- `pnpm --filter @workspace/api-spec run codegen` — регенерация Zod/React Query из OpenAPI.

## Переменные окружения

- `DATABASE_URL` — Postgres (Replit DB).
- `SESSION_SECRET` — для подписи сессий.
- `AI_INTEGRATIONS_GEMINI_BASE_URL`, `AI_INTEGRATIONS_GEMINI_API_KEY` — прокси Gemini.

## Сессии

Без логина: куки `altera_sid` (HTTP-only, 1 год). Каждая сессия = свой персонаж в БД.
