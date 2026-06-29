import { Router } from "express";
import { list } from "../controllers/directoryController.js";

const router = Router();

router.get("/", list);

export default router;
