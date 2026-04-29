import { Router, type IRouter } from "express";
import healthRouter from "./health";
import metaRouter from "./meta";
import characterRouter from "./character";
import battleRouter from "./battle";
import npcRouter from "./npc";
import ledgerRouter from "./ledger";
import inventoryRouter from "./inventory";
import locationRouter from "./location";
import questRouter from "./quest";
import achievementRouter from "./achievement";
import referralRouter from "./referral";
import bestiaryRouter from "./bestiary";
import realtimeRouter from "./realtime";

const router: IRouter = Router();

router.use(healthRouter);
router.use(metaRouter);
router.use(characterRouter);
router.use(battleRouter);
router.use(npcRouter);
router.use(ledgerRouter);
router.use(inventoryRouter);
router.use(locationRouter);
router.use(questRouter);
router.use(achievementRouter);
router.use(referralRouter);
router.use(bestiaryRouter);
router.use(realtimeRouter);

export default router;
