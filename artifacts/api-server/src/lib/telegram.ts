import crypto from "node:crypto";

export interface TelegramUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
  is_premium?: boolean;
}

export interface TelegramAuth {
  user: TelegramUser;
  authDate: number;
  startParam?: string;
}

const MAX_AGE_SEC = 60 * 60 * 24; // 24h

function timingSafeEqHex(a: string, b: string): boolean {
  const ab = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  if (ab.length !== bb.length || ab.length === 0) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/**
 * Validate Telegram WebApp `initData` per the official spec:
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 *
 * `initData` is a URL-encoded query string. `hash` is HMAC-SHA256 of the
 * data-check-string keyed by HMAC-SHA256("WebAppData", botToken).
 */
export function validateTelegramInitData(
  initData: string,
  botToken: string,
): TelegramAuth | null {
  if (!initData || !botToken) return null;

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;
  params.delete("hash");
  // signature key may be present in newer SDKs; not part of data-check-string
  params.delete("signature");

  const dataCheckArr: string[] = [];
  Array.from(params.keys())
    .sort()
    .forEach((k) => {
      const v = params.get(k);
      if (v !== null) dataCheckArr.push(`${k}=${v}`);
    });
  const dataCheckString = dataCheckArr.join("\n");

  const secretKey = crypto
    .createHmac("sha256", "WebAppData")
    .update(botToken)
    .digest();
  const computed = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  if (!timingSafeEqHex(computed, hash)) return null;

  const authDate = Number(params.get("auth_date"));
  if (!Number.isFinite(authDate) || authDate <= 0) return null;
  const ageSec = Math.floor(Date.now() / 1000) - authDate;
  if (ageSec > MAX_AGE_SEC) return null;

  const userJson = params.get("user");
  if (!userJson) return null;
  let user: TelegramUser;
  try {
    user = JSON.parse(userJson) as TelegramUser;
  } catch {
    return null;
  }
  if (!user || typeof user.id !== "number") return null;

  const startParam = params.get("start_param") ?? undefined;
  return { user, authDate, startParam };
}
