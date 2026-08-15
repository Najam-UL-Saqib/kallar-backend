import { Router } from "express";
import { islamic, onThisDay, cat, dog, meme, bored, apod } from "../controllers/discoverController.js";

const router = Router();

// All public/read-only — no auth needed, same as directory.routes.js.
// Protected only by the global IP rate limiter applied to all /api routes.
router.get("/islamic",     islamic);
router.get("/on-this-day", onThisDay);
router.get("/cat",         cat);
router.get("/dog",         dog);
router.get("/meme",        meme);
router.get("/bored",       bored);
router.get("/apod",        apod);

export default router;
