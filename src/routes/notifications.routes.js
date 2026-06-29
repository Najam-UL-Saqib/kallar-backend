import { Router } from "express";
import { list, readAll, count } from "../controllers/notificationsController.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = Router();

router.use(requireAuth);

router.get("/",     list);
router.get("/count", count);
router.post("/read", readAll);

export default router;
