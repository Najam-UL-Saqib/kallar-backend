import { Router } from "express";
import { requireAuth } from "../middleware/authMiddleware.js";
import { getVapidKey, subscribe, unsubscribe } from "../controllers/pushController.js";

const router = Router();

router.get("/vapid-key", getVapidKey);
router.post("/subscribe",   requireAuth, subscribe);
router.post("/unsubscribe", requireAuth, unsubscribe);

export default router;
