import { Router } from "express";
import { getDevice } from "../controllers/deviceController.js";

const router = Router();

router.get("/", getDevice);

export default router;
