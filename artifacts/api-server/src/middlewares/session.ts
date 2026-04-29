import type { Request, Response, NextFunction } from "express";
import crypto from "node:crypto";
import { validateTelegramInitData, type TelegramAuth } from "../lib/telegram";

const COOKIE_NAME = "altera_sid";
const COOKIE_MAX_AGE_MS = 60 * 60 * 24 * 365 * 1000;
const HEADER = "x-telegram-init-data";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      sessionId: string;
      telegram?: TelegramAuth | null;
    }
  }
}

export function sessionMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const botToken = process.env["TELEGRAM_BOT_TOKEN"];
  const initData = req.header(HEADER);

  if (initData && botToken) {
    const auth = validateTelegramInitData(initData, botToken);
    if (auth) {
      req.telegram = auth;
      req.sessionId = `tg_${auth.user.id}`;
      next();
      return;
    }
    // Invalid initData: refuse rather than silently downgrade — prevents spoofing.
    res.status(401).json({ error: "Невалидные данные Telegram" });
    return;
  }

  let sid = (req as Request & { cookies?: Record<string, string> }).cookies?.[
    COOKIE_NAME
  ];

  if (!sid) {
    sid = crypto.randomBytes(24).toString("hex");
    res.cookie(COOKIE_NAME, sid, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: COOKIE_MAX_AGE_MS,
      path: "/",
    });
  }

  req.sessionId = sid;
  req.telegram = null;
  next();
}
