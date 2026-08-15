import { Router } from "express";
import {
  getListings, getListingById, remainingListings, createListingHandler,
  updateListingHandler, updateStatus, removeListing, reportListingHandler,
} from "../controllers/marketplaceController.js";
import { requireAuth, optionalAuth } from "../middleware/authMiddleware.js";
import { imageUpload } from "../middleware/upload.js";

const router = Router();

// Specific paths BEFORE the /:id wildcard to avoid shadowing
router.get("/remaining",    requireAuth,  remainingListings);
router.get("/",             optionalAuth, getListings);
router.get("/:id",          optionalAuth, getListingById);
router.post("/",            requireAuth, imageUpload.array("images", 3), createListingHandler);
router.put("/:id",          requireAuth, imageUpload.array("images", 3), updateListingHandler);
router.patch("/:id/status", requireAuth, updateStatus);
router.delete("/:id",       requireAuth, removeListing);
router.post("/:id/report",  requireAuth, reportListingHandler);

export default router;
