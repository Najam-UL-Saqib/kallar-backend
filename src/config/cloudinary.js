import { v2 as cloudinary } from "cloudinary";
import { env } from "./env.js";

let configured = false;

export function getCloudinary() {
  if (!configured) {
    if (!env.cloudinaryUrl) throw new Error("CLOUDINARY_URL is not configured");
    process.env.CLOUDINARY_URL = env.cloudinaryUrl;
    cloudinary.config({ secure: true });
    configured = true;
  }
  return cloudinary;
}
