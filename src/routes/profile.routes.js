import { Router } from "express";
import { requireAuth, optionalAuth } from "../middleware/authMiddleware.js";
import { profile, updateProfileHandler, myPosts, publicProfile, publicUserPosts } from "../controllers/profileController.js";

const router = Router();

router.get("/user/:userId",       optionalAuth, publicProfile);
router.get("/user/:userId/posts", optionalAuth, publicUserPosts);

router.use(requireAuth);
router.get("/",      profile);
router.put("/",      updateProfileHandler);
router.get("/posts", myPosts);

export default router;
