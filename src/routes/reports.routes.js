import { Router } from "express";
import { reportPost } from "../controllers/reportsController.js";

const router = Router();

router.post("/:id/report", reportPost);

export default router;
