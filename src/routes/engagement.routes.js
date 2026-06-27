import { Router } from "express";
import { like, comment, share, stats, comments } from "../controllers/engagementController.js";

const router = Router();

router.get("/:id/stats", stats);
router.get("/:id/comments", comments);
router.post("/:id/like", like);
router.post("/:id/comments", comment);
router.post("/:id/share", share);

export default router;
