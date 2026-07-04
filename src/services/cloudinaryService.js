import { getCloudinary } from "../config/cloudinary.js";
import { HttpError } from "../middleware/errorHandler.js";
import sharp from "sharp";

const MAX_IMAGE_BYTES = 1 * 1024 * 1024; // 1 MB

/**
 * Compresses an image buffer using sharp (WebP, quality 80, max 1920px wide).
 * Returns the compressed Buffer.
 */
async function compressImage(buffer) {
  return sharp(buffer)
    .rotate()                        // auto-orient based on EXIF
    .resize({ width: 1920, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();
}

/**
 * Compresses the image, checks the compressed size is ≤ 1 MB,
 * then uploads to Cloudinary.
 * Throws HttpError 400 if even after compression the file exceeds 1 MB.
 */
export async function uploadImageBuffer(buffer) {
  // 1. Compress
  const compressed = await compressImage(buffer);

  // 2. Size check (post-compression)
  if (compressed.length > MAX_IMAGE_BYTES) {
    throw new HttpError(
      400,
      "Image is too large even after compression. Please upload an image under 1 MB.",
    );
  }

  // 3. Upload compressed buffer to Cloudinary
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
