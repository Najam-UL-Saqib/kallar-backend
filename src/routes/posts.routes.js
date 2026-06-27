import { Router } from "express";
import { getPosts, getPostById, createPost, updatePost } from "../controllers/postsController.js";
import { requireAuth, optionalAuth } from "../middleware/authMiddleware.js";
import { imageUpload } from "../middleware/upload.js";

const router = Router();

router.get("/",    optionalAuth, getPosts);
router.get("/:id", optionalAuth, getPostById);
router.post("/",   requireAuth, imageUpload.single("image"), createPost);
router.put("/:id", requireAuth, updatePost);

export default router;
