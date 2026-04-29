import { Router, type IRouter } from "express";
import healthRouter from "./health";
import metaRouter from "./meta";
import characterRouter from "./character";
import battleRouter from "./battle";
import npcRouter from "./npc";
import ledgerRouter from "./ledger";
import inventoryRouter from "./inventory";

const router: IRouter = Router();

router.use(healthRouter);
router.use(metaRouter);
router.use(characterRouter);
router.use(battleRouter);
router.use(npcRouter);
router.use(ledgerRouter);
router.use(inventoryRouter);

export default router;
