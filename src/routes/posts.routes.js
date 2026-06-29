import { Router } from "express";
import { getPosts, getPostById, createPost, updatePost, deletePost, remainingPosts } from "../controllers/postsController.js";
import { bookmarks } from "../controllers/engagementController.js";
import { requireAuth, optionalAuth } from "../middleware/authMiddleware.js";
import { imageUpload } from "../middleware/upload.js";

const router = Router();

// Specific paths BEFORE the /:id wildcard to avoid shadowing
router.get("/remaining", requireAuth,  remainingPosts);
router.get("/bookmarks", requireAuth,  bookmarks);
router.get("/",          optionalAuth, getPosts);
router.get("/:id",       optionalAuth, getPostById);
router.post("/",         requireAuth, imageUpload.single("image"), createPost);
router.put("/:id",       requireAuth, updatePost);
router.delete("/:id",    requireAuth, deletePost);

export default router;
