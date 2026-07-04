import { getCloudinary } from "../config/cloudinary.js";
import { HttpError } from "../middleware/errorHandler.js";
import sharp from "sharp";

const MAX_COMPRESSED_BYTES = 1 * 1024 * 1024; // 1 MB — hard ceiling after compression

/**
 * Attempt to compress an image buffer.
 * @param {Buffer} buffer - Raw image buffer
 * @param {number} quality   - WebP quality (0–100)
 * @param {number} maxWidth  - Max pixel width
 * @returns {Promise<Buffer>}
 */
async function compress(buffer, quality, maxWidth) {
  return sharp(buffer)
    .rotate()                                      // auto-orient via EXIF
    .resize({ width: maxWidth, withoutEnlargement: true })
    .webp({ quality })
    .toBuffer();
}

/**
 * Compresses the image (up to 2 attempts), checks that the result is ≤ 1 MB,
 * then uploads to Cloudinary.
 *
 * Attempt 1 — WebP q80,  max 1920 px wide  (good quality, reasonable size)
 * Attempt 2 — WebP q50,  max 1280 px wide  (more aggressive, for larger originals)
 *
 * If the image is still > 1 MB after both attempts, throws HttpError 400 with a
 * user-friendly message that includes a link to an online compression tool.
 */
export async function uploadImageBuffer(buffer) {
  // --- Attempt 1: high quality ------------------------------------------------
  let compressed = await compress(buffer, 80, 1920);

  // --- Attempt 2: lower quality (only if needed) ------------------------------
  if (compressed.length > MAX_COMPRESSED_BYTES) {
    compressed = await compress(buffer, 50, 1280);
  }

  // --- Final size check -------------------------------------------------------
  if (compressed.length > MAX_COMPRESSED_BYTES) {
    throw new HttpError(
      400,
      "تصویر کمپریس کرنے کے بعد بھی 1 MB سے بڑی ہے۔ براہ کرم squoosh.app پر کمپریس کریں پھر دوبارہ اپلوڈ کریں۔ | " +
      "Image is still larger than 1 MB after two compression attempts. " +
      "Please compress it at squoosh.app then re-upload. [COMPRESS_LINK]",
    );
  }

  // --- Upload to Cloudinary ---------------------------------------------------
  const cloudinary = getCloudinary();
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "post-images", resource_type: "image" },
      (err, result) => {
        if (err) return reject(new HttpError(502, "Image upload failed"));
        resolve({ url: result.secure_url, path: result.public_id });
      },
    );
    stream.end(compressed);
  });
}
