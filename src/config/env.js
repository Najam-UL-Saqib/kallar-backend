import "dotenv/config";

const required = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "ADMIN_PASSWORD_HASH",
  "ADMIN_SESSION_SECRET",
  "DEVICE_TOKEN_SECRET",
  "FRONTEND_URL",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_CALLBACK_URL",
];

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required env var: ${key}`);
  }
}

export const env = {
  nodeEnv:              process.env.NODE_ENV || "development",
  port:                 Number(process.env.PORT) || 4000,
  frontendUrl:          process.env.FRONTEND_URL,
  supabaseUrl:          process.env.SUPABASE_URL,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  cloudinaryUrl:        process.env.CLOUDINARY_URL,
  adminPasswordHash:    process.env.ADMIN_PASSWORD_HASH,
  adminSessionSecret:   process.env.ADMIN_SESSION_SECRET,
  deviceTokenSecret:    process.env.DEVICE_TOKEN_SECRET,
  googleClientId:       process.env.GOOGLE_CLIENT_ID,
  googleClientSecret:   process.env.GOOGLE_CLIENT_SECRET,
  googleCallbackUrl:    process.env.GOOGLE_CALLBACK_URL,
};

export const isProd = env.nodeEnv === "production";
