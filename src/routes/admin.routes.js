import { Router } from "express";
import * as admin from "../controllers/adminController.js";
import { requireAdmin } from "../middleware/adminAuth.js";
import { imageUpload } from "../middleware/upload.js";

const router = Router();

router.post("/login",  admin.login);
router.post("/logout", admin.logout);

router.use(requireAdmin);

router.get("/stats", admin.stats);

router.get("/posts",          admin.listPosts);
router.post("/posts",         admin.createPost);
router.put("/posts/:id",      admin.updatePost);
router.delete("/posts/:id",   admin.deletePost);
router.patch("/posts/:id/pin", admin.pinPost);

router.get("/reports",          admin.reports);
router.delete("/reports/:id",   admin.dismissReport);

router.post("/upload", imageUpload.single("image"), admin.uploadImage);

// Business directory management
router.get("/directory",        admin.listDirectoryAdmin);
router.post("/directory",       admin.createDirectoryEntry);
router.put("/directory/:id",    admin.updateDirectoryEntry);
router.delete("/directory/:id", admin.deleteDirectoryEntry);

// Generic table viewer — must come last to avoid shadowing specific routes above
router.get("/:table",        admin.listTable);
router.delete("/:table/:id", admin.deleteRow);

export default router;
