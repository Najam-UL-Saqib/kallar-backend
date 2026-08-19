import { Router } from "express";
import { requireAuth, optionalAuth } from "../middleware/authMiddleware.js";
import { today, answer, leaderboard } from "../controllers/triviaController.js";

const router = Router();

router.get("/today", optionalAuth, today);
router.get("/leaderboard", optionalAuth, leaderboard);
router.post("/answer", requireAuth, answer);

export default router;
