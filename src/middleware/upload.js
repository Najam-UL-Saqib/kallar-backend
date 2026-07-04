import multer from "multer";
import { MAX_RAW_IMAGE_BYTES } from "../utils/validators.js";

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

// Accept up to 3 MB raw; the backend compresses to ≤1 MB before storing on Cloudinary.
export const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_RAW_IMAGE_BYTES },
  fileFilter(req, file, cb) {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      const err = new Error("Only JPEG, PNG, WEBP, or GIF images are allowed");
      err.status = 400;
      return cb(err);
    }
    cb(null, true);
  },
});
