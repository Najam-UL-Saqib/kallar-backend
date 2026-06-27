import { Router } from "express";
import { googleLogin, googleCallback, logout, me } from "../controllers/authController.js";

const router = Router();

router.get("/google",   googleLogin);
router.get("/callback", googleCallback);
router.post("/logout",  logout);
router.get("/me",       me);  // returns session data or null — always 200

export default router;
