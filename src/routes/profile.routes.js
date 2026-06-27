import { Router } from "express";
import { requireAuth } from "../middleware/authMiddleware.js";
import { profile, updateProfileHandler, myPosts } from "../controllers/profileController.js";

const router = Router();

router.use(requireAuth); // all profile routes require login

router.get("/",       profile);
router.put("/",       updateProfileHandler);
router.get("/posts",  myPosts);

export default router;
