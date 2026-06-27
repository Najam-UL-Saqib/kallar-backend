import { getCloudinary } from "../config/cloudinary.js";
import { HttpError } from "../middleware/errorHandler.js";

export function uploadImageBuffer(buffer) {
  const cloudinary = getCloudinary();
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "post-images" },
      (err, result) => {
        if (err) return reject(new HttpError(502, "Image upload failed"));
        resolve({ url: result.secure_url, path: result.public_id });
      },
    );
    stream.end(buffer);
  });
}
