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
  buffActive: boolean;
  buffExpiresAt: string | null;
}

export const listLocations = () => request<LocationDTO[]>("/locations");

export interface VisitResult {
  locationId: string;
  locationName: string;
  isFirstDiscoverer: boolean;
  buffActive: boolean;
  buffExpiresAt: string | null;
  achievementsAwarded: string[];
}

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
  rarity: "common" | "uncommon" | "rare";
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
