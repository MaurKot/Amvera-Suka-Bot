import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import crypto from "node:crypto";
import { db, characters, referrals } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getCurrentCharacter } from "../game/characterService";

const router: IRouter = Router();

const REWARD_REFERRER = 100;
const REWARD_REFEREE = 50;

function generateCode(seed: string): string {
  return crypto.createHash("sha1").update(seed).digest("base64url").slice(0, 8).toUpperCase();
}

router.get("/referral/code", async (req: Request, res: Response) => {
  const c = await getCurrentCharacter(req.sessionId);
  if (!c) {
    res.status(404).json({ error: "Персонаж не найден" });
    return;
  }
  let code = c.referralCode;
  if (!code) {
    code = generateCode(`${c.id}-${c.sessionId}`);
    await db.update(characters).set({ referralCode: code }).where(eq(characters.id, c.id));
  }
  const used = await db.select().from(referrals).where(eq(referrals.referrerId, c.id));
  res.json({
    code,
    inviteLink: `https://t.me/share/url?url=https://t.me/?start=${code}`,
    rewardForYou: REWARD_REFERRER,
    rewardForFriend: REWARD_REFEREE,
    invitedCount: used.length,
    totalEarned: used.reduce((sum, r) => sum + r.rewardSilver, 0),
  });
});

const RedeemBody = z.object({ code: z.string().min(1).max(32) });

router.post("/referral/redeem", async (req: Request, res: Response) => {
  const parsed = RedeemBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Не указан код" });
    return;
  }
  const c = await getCurrentCharacter(req.sessionId);
  if (!c) {
    res.status(404).json({ error: "Сначала создай персонажа" });
    return;
  }
  if (c.referredBy) {
    res.status(400).json({ error: "Ты уже отметил наставника" });
    return;
  }
  const code = parsed.data.code.trim().toUpperCase();
  const [referrer] = await db
    .select()
    .from(characters)
    .where(eq(characters.referralCode, code))
    .limit(1);
  if (!referrer) {
    res.status(404).json({ error: "Такого кода нет в хрониках" });
    return;
  }
  if (referrer.id === c.id) {
    res.status(400).json({ error: "Нельзя пригласить самого себя" });
    return;
  }

  await db
    .update(characters)
    .set({ referredBy: referrer.id, silver: c.silver + REWARD_REFEREE })
    .where(eq(characters.id, c.id));
  await db
    .update(characters)
    .set({ silver: referrer.silver + REWARD_REFERRER })
    .where(eq(characters.id, referrer.id));

  await db.insert(referrals).values({
    referrerId: referrer.id,
    refereeId: c.id,
    code,
    rewardSilver: REWARD_REFERRER,
  });

  res.json({
    ok: true,
    referrerName: referrer.name,
    rewardSilver: REWARD_REFEREE,
  });
});

export default router;
