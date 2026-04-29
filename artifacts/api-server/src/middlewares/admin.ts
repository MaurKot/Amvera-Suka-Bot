import type { Request, Response, NextFunction } from "express";
import crypto from "node:crypto";
import { db, adminLog } from "@workspace/db";

const HEADER = "x-admin-token";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      adminToken?: string;
      adminTokenLast6?: string;
    }
  }
}

function getExpected(): string | null {
  const v = process.env["ADMIN_TOKEN"];
  if (!v || v.length < 8) return null;
  return v;
}

/**
 * Token-protected admin middleware.
 *
 * Refuses with 503 if `ADMIN_TOKEN` is unset (unconfigured = closed),
 * 401 if missing/wrong header. Constant-time compare to defeat timing
 * attacks. Every privileged request is appended to `admin_log`.
 */
export function adminAuth(req: Request, res: Response, next: NextFunction): void {
  const expected = getExpected();
  if (!expected) {
    res.status(503).json({ error: "Админ-панель не настроена. Установите переменную ADMIN_TOKEN (минимум 8 символов)." });
    return;
  }
  const provided = req.header(HEADER);
  if (!provided) {
    res.status(401).json({ error: "Не указан токен" });
    return;
  }
  // Constant-time compare requires equal-length buffers.
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    res.status(401).json({ error: "Неверный токен" });
    return;
  }
  req.adminToken = expected;
  req.adminTokenLast6 = expected.slice(-6);
  next();
}

export async function logAdminAction(
  tokenLast6: string,
  action: string,
  targetType: string | null,
  targetId: string | null,
  payload: Record<string, unknown>,
): Promise<void> {
  await db.insert(adminLog).values({
    adminToken: tokenLast6,
    action,
    targetType,
    targetId,
    payloadJson: payload,
  });
}
