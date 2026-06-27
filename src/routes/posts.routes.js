import { Router } from "express";
import { getPosts, getPostById, createPost, updatePost } from "../controllers/postsController.js";
import { imageUpload } from "../middleware/upload.js";

const router = Router();

router.get("/", getPosts);
router.get("/:id", getPostById);
router.post("/", imageUpload.single("image"), createPost);
router.put("/:id", updatePost);

export default router;
