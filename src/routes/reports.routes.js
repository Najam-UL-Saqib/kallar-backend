import { Router } from "express";
import { requireAuth } from "../middleware/authMiddleware.js";
import { reportPost } from "../controllers/reportsController.js";

const router = Router();

router.post("/:id/report", requireAuth, reportPost);

export default router;
