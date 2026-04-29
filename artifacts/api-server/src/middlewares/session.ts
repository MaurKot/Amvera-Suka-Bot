import type { Request, Response, NextFunction } from "express";
import crypto from "node:crypto";

const COOKIE_NAME = "altera_sid";
const COOKIE_MAX_AGE_MS = 60 * 60 * 24 * 365 * 1000;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      sessionId: string;
    }
  }
}

export function sessionMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
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
  next();
}
