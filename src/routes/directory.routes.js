import { Router } from "express";
import { list, submit } from "../controllers/directoryController.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = Router();

router.get("/", list);
router.post("/", requireAuth, submit);

export default router;
