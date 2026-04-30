// Hand-written API client for endpoints added in this iteration.
// We use fetch directly so the global fetch patch (Telegram initData header)
// applies automatically.

const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}/api${path}`, {
    credentials: "include",
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body?.error) detail = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  if (res.status === 204) return null as T;
  return (await res.json()) as T;
}

// --- Locations -------------------------------------------------------------

export interface LocationEventBadge {
  title: string;
  severity: number;
  eventKind: string;
}

export interface LocationDTO {
  id: string;
  name: string;
  region: string;
  description: string;
  type: string;
  isSafe: boolean;
  isStarter: boolean;
  isDiscovered: boolean;
  discoveredByName: string | null;
  discoveredAt: string | null;
  isCurrent: boolean;
  isReachable: boolean;
  buffActive: boolean;
  buffExpiresAt: string | null;
  // P2 graph + procedural metadata
  connectedTo: string[];
  coordX: number;
  coordY: number;
  isFrontier: boolean;
  isGenerated: boolean;
  generatedAt: string | null;
  // P6 active world events touching this location
  activeEvents: LocationEventBadge[];
  // P7 — passage / city-level (Тропа Торговца guard system)
  cityLevel: number;
  requiresGuard: boolean;
  destinationCityId: string | null;
  // v2 — Map UX: 0..5 colour ramp from safe (0) to lethal frontier (5).
  dangerLevel: number;
  recommendedLevel: number;
}

export const listLocations = () => request<LocationDTO[]>("/locations");

// P7 — Auto-discovery payload returned by /locations/visit when stepping onto
// a frontier node and the discovery roll succeeds. Replaces the old manual
// "Шагнуть за горизонт" action.
export interface AutoDiscoveredPath {
  locationId: string;
  locationName: string;
  region: string;
  description: string;
}

export interface VisitResult {
  locationId: string;
  locationName: string;
  isFirstDiscoverer: boolean;
  buffActive: boolean;
  buffExpiresAt: string | null;
  achievementsAwarded: string[];
  /** P7 — set when the visit revealed a brand-new path beyond a frontier. */
  discoveredNewPath: AutoDiscoveredPath | null;
}

// P7 — guard check before traversing a `requiresGuard` passage (Тропа Торговца).
export interface GuardCheckResult {
  passageId: string;
  passageName: string;
  destinationCityId: string | null;
  destinationCityName: string;
  destinationCityLevel: number;
  playerLevel: number;
  tooWeak: boolean;
  encounterChance: number;
  warning: string;
}

export const guardCheck = (passageId: string) =>
  request<GuardCheckResult>("/locations/guard-check", {
    method: "POST",
    body: JSON.stringify({ passageId }),
  });

export const visitLocation = (locationId: string) =>
  request<VisitResult>("/locations/visit", {
    method: "POST",
    body: JSON.stringify({ locationId }),
  });

// --- Quests ----------------------------------------------------------------

export interface QuestDTO {
  id: string;
  title: string;
  description: string;
  type: string;
  giverId: string | null;
  locationId: string | null;
  objectives: { key: string; text: string; target?: string; count?: number }[];
  rewards: { silver?: number; exp?: number; reputation?: Record<string, number> };
  isStarter: boolean;
  status: "available" | "active" | "completed" | "failed";
  acceptedAt: string | null;
  completedAt: string | null;
}

export const listQuests = () => request<QuestDTO[]>("/quests");
export const acceptQuest = (questId: string) =>
  request<{ ok: true; questId: string; status: "active" }>(`/quests/${questId}/accept`, {
    method: "POST",
  });
export const completeQuest = (questId: string) =>
  request<{ ok: true; questId: string; status: "completed"; rewards: { silver: number; exp: number; reputation: Record<string, number> } }>(
    `/quests/${questId}/complete`,
    { method: "POST" },
  );

// --- Achievements ----------------------------------------------------------

export interface AchievementDTO {
  key: string;
  title: string;
  description: string;
  icon: string;
  buffDurationSec: number;
  earned: boolean;
  count: number;
  activeBuffExpiresAt: string | null;
  targets: { targetId: string | null; earnedAt: string; expiresAt: string | null }[];
}

export const listAchievements = () => request<AchievementDTO[]>("/achievements");

// --- Referrals -------------------------------------------------------------

export interface ReferralInfo {
  code: string;
  inviteLink: string;
  rewardForYou: number;
  rewardForFriend: number;
  invitedCount: number;
  totalEarned: number;
}

export const getReferralInfo = () => request<ReferralInfo>("/referral/code");
export const redeemReferral = (code: string) =>
  request<{ ok: true; referrerName: string; rewardSilver: number }>("/referral/redeem", {
    method: "POST",
    body: JSON.stringify({ code }),
  });

// --- Bestiary --------------------------------------------------------------

export interface BestiaryEntry {
  key: string;
  name: string;
  lore: string;
  level: number;
  locationId: string | null;
  firstEncounteredByName: string | null;
  firstEncounteredAt: string | null;
  encounterCount: number;
}

export const listBestiary = () => request<BestiaryEntry[]>("/bestiary");

// --- Merchant / shop -------------------------------------------------------

export interface ShopItemDTO {
  catalogKey: string;
  itemKey: string;
  name: string;
  itemType: "weapon" | "armor" | "trinket" | "potion" | "misc";
  rarity: "common" | "uncommon" | "rare" | "epic" | "legendary";
  price: number;
  description: string;
  stats: Record<string, number>;
  stackable: boolean;
}

export interface ShopDTO {
  npcId: string;
  npcName: string;
  greeting: string;
  items: ShopItemDTO[];
  silver: number;
}

export const getNpcShop = (npcId: string) =>
  request<ShopDTO>(`/npc/${encodeURIComponent(npcId)}/shop`);

export interface BuyResultDTO {
  ok: true;
  purchased: { catalogKey: string; itemKey: string; name: string; price: number };
  silverLeft: number;
  reputation: number;
  message: string;
}

export const buyFromNpc = (npcId: string, catalogKey: string) =>
  request<BuyResultDTO>(`/npc/${encodeURIComponent(npcId)}/shop/buy`, {
    method: "POST",
    body: JSON.stringify({ catalogKey }),
  });

// --- P3 AI-generated quests -----------------------------------------------

export type GeneratedQuestStatus =
  | "available"
  | "accepted"
  | "declined"
  | "completed"
  | "failed";

export interface GeneratedQuestDTO {
  id: number;
  npcId: string;
  npcName: string;
  title: string;
  description: string;
  objective: string;
  targetType: string;
  targetRef: string | null;
  targetCount: number;
  rewardSilver: number;
  rewardExp: number;
  rewardRepDelta: number;
  status: GeneratedQuestStatus;
  createdAt: string;
  acceptedAt?: string | null;
  completedAt?: string | null;
}

export const listGeneratedQuests = () =>
  request<GeneratedQuestDTO[]>("/quests/generated");

export const generateQuestFromNpc = (npcId: string) =>
  request<GeneratedQuestDTO>(`/npc/${encodeURIComponent(npcId)}/quest/generate`, {
    method: "POST",
  });

export const updateGeneratedQuestStatus = (
  id: number,
  status: Exclude<GeneratedQuestStatus, "available">,
) =>
  request<{ id: number; status: GeneratedQuestStatus; rewardSilver: number; rewardExp: number }>(
    `/quests/generated/${id}/status`,
    { method: "POST", body: JSON.stringify({ status }) },
  );

// --- P5 Admin panel client (token-authenticated) --------------------------
// Token is *never* persisted to disk by us — caller stores it in sessionStorage.

async function adminRequest<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}/api${path}`, {
    credentials: "include",
    headers: {
      "content-type": "application/json",
      "x-admin-token": token,
      ...(init?.headers ?? {}),
    },
    ...init,
  });
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body?.error) detail = body.error;
    } catch {
      /* ignore */
    }
    if (res.status === 401) detail = "Неверный токен администратора";
    if (res.status === 503) detail = "ADMIN_TOKEN не задан на сервере";
    throw new Error(detail);
  }
  if (res.status === 204) return null as T;
  return (await res.json()) as T;
}

export interface AdminOverview {
  characters: number;
  npcs: number;
  locations: number;
  activeEvents: number;
  aiCycles: number;
  generatedQuests: number;
  bannedPlayers: number;
}

export const adminGetOverview = (token: string) =>
  adminRequest<AdminOverview>(token, "/admin/overview");

export interface AdminNpcRow {
  id: string;
  name: string;
  title: string | null;
  tier: string;
  locationId: string;
  faction: string | null;
  role: string;
  shortProfile: string;
  fullLore: string | null;
  voiceStyle: string;
  knownFacts: string;
  secret: string | null;
  baseHp: number;
  baseDamage: number;
  level: number;
  isHostile: boolean;
  personality: string;
  motives: string | null;
  questPoolJson: unknown;
}

export const adminListNpcs = (token: string) =>
  adminRequest<AdminNpcRow[]>(token, "/admin/npcs");

export const adminPatchNpc = (
  token: string,
  npcId: string,
  patch: Partial<Pick<AdminNpcRow, "shortProfile" | "fullLore" | "voiceStyle" | "knownFacts" | "personality" | "motives" | "isHostile">>,
) =>
  adminRequest<AdminNpcRow>(token, `/admin/npcs/${encodeURIComponent(npcId)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });

export interface AdminLocationRow {
  id: string;
  name: string;
  region: string;
  description: string;
  type: string;
  isSafe: boolean;
  isStarter: boolean;
  isFrontier: boolean;
  isGenerated: boolean;
  coordX: number;
  coordY: number;
  connectedTo: string[];
  discoveredByName: string | null;
  discoveredAt: string | null;
}

export const adminListLocations = (token: string) =>
  adminRequest<AdminLocationRow[]>(token, "/admin/locations");

export const adminGenerateLocation = (token: string, fromLocationId: string, hint?: string) =>
  adminRequest<{ ok: true; location: AdminLocationRow; via: "ai" | "fallback" }>(
    token,
    `/admin/locations/generate`,
    { method: "POST", body: JSON.stringify({ fromLocationId, hint }) },
  );

export interface AdminWorldEvent {
  id: number;
  slug: string;
  eventKind: string;
  title: string;
  description: string;
  severity: number;
  isActive: boolean;
  affectedLocationsJson: string[] | null;
  startsAt: string;
  expiresAt: string;
  sourceCycleId: number | null;
}

export const adminListEvents = (token: string) =>
  adminRequest<AdminWorldEvent[]>(token, "/admin/events/active");

export const adminEndEvent = (token: string, eventId: number) =>
  adminRequest<AdminWorldEvent>(token, `/admin/events/${eventId}/end`, {
    method: "POST",
  });

export const adminCreateEvent = (
  token: string,
  body: {
    title: string;
    description: string;
    eventKind: string;
    affectedLocations: string[];
    severity: number;
    durationHours: number;
  },
) =>
  adminRequest<AdminWorldEvent>(token, "/admin/events", {
    method: "POST",
    body: JSON.stringify(body),
  });

export interface AdminAiCycle {
  id: number;
  startedAt: string;
  finishedAt: string | null;
  cycleKind: string;
  status: string;
  notesJson: unknown;
  errorText: string | null;
}

export const adminListCycles = (token: string) =>
  adminRequest<AdminAiCycle[]>(token, "/admin/ai-cycles");

export const adminRunCycle = (token: string) =>
  adminRequest<{ ok: true; cycleId: number; notes: unknown }>(token, "/admin/ai-cycles/run", {
    method: "POST",
  });

export interface AdminPlayerModeration {
  characterId: number;
  isBanned: boolean;
  isMuted: boolean;
  warnCount: number;
  flagCount: number;
  reason: string | null;
  updatedAt: string | null;
}

export interface AdminPlayerRow {
  id: number;
  name: string;
  telegramId: string | number | null;
  telegramUsername: string | null;
  level: number;
  experience: number;
  silver: number;
  locationId: string;
  isAlive: boolean;
  createdAt: string | null;
  moderation: AdminPlayerModeration | null;
}

export const adminListPlayers = (token: string) =>
  adminRequest<AdminPlayerRow[]>(token, "/admin/players");

export const adminModeratePlayer = (
  token: string,
  characterId: number,
  patch: { isBanned?: boolean; isMuted?: boolean; warnDelta?: number; reason?: string | null },
) =>
  adminRequest<AdminPlayerModeration>(token, `/admin/players/${characterId}/moderation`, {
    method: "POST",
    body: JSON.stringify(patch),
  });

export interface AdminAuditEntry {
  id: number;
  tokenLast6: string;
  action: string;
  targetKind: string | null;
  targetId: string | null;
  detailsJson: unknown;
  createdAt: string;
}

export const adminListAuditLog = (token: string) =>
  adminRequest<AdminAuditEntry[]>(token, "/admin/audit-log");
