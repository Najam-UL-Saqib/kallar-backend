import { Router } from "express";
import {
  like, comment, removeComment, commentLike,
  share, stats, comments, bookmark, pollVote, pollResults,
} from "../controllers/engagementController.js";
import { requireAuth, optionalAuth } from "../middleware/authMiddleware.js";

const router = Router();

router.get("/:id/stats",                         optionalAuth, stats);
router.get("/:id/comments",                      optionalAuth, comments);
router.get("/:id/poll-results",                  optionalAuth, pollResults);
router.post("/:id/like",                         requireAuth,  like);
router.post("/:id/comments",                     requireAuth,  comment);
router.delete("/:id/comments/:commentId",        requireAuth,  removeComment);
router.post("/:id/comments/:commentId/like",     requireAuth,  commentLike);
router.post("/:id/share",                        requireAuth,  share);
router.post("/:id/bookmark",                     requireAuth,  bookmark);
router.post("/:id/vote",                         requireAuth,  pollVote);

export default router;
