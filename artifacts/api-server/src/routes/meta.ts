import { Router, type IRouter } from "express";
import { RACES, CLASSES, LOCATIONS, ENEMIES } from "../game/lore";

const router: IRouter = Router();

router.get("/meta/lore", (_req, res) => {
  res.json({
    races: RACES.map((r) => ({
      key: r.key,
      nameRu: r.nameRu,
      nameEn: r.nameEn,
      lore: r.lore,
      creatureForm: r.creatureForm,
      bonuses: r.bonuses,
    })),
    classes: CLASSES.map((c) => ({
      key: c.key,
      nameRu: c.nameRu,
      desc: c.desc,
      resource: c.resource,
      startStats: c.startStats,
    })),
    locations: LOCATIONS,
    enemies: ENEMIES,
  });
});

export default router;
