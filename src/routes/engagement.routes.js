import { Router } from "express";
import { like, comment, share, stats, comments } from "../controllers/engagementController.js";
import { requireAuth, optionalAuth } from "../middleware/authMiddleware.js";

const router = Router();

router.get("/:id/stats",    optionalAuth, stats);
router.get("/:id/comments", optionalAuth, comments);
router.post("/:id/like",    requireAuth,  like);
router.post("/:id/comments",requireAuth,  comment);
router.post("/:id/share",   requireAuth,  share);

export default router;
