import express from "express";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import { isProd } from "./config/env.js";
import { securityHeaders, corsMiddleware, csrfOriginCheck } from "./middleware/security.js";
import { ipRateLimiter, writeRateLimiter, requestId } from "./middleware/rateLimiter.js";
import { sessionMiddleware } from "./middleware/session.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";

import authRoutes       from "./routes/auth.routes.js";
import postsRoutes      from "./routes/posts.routes.js";
import engagementRoutes from "./routes/engagement.routes.js";
import reportsRoutes    from "./routes/reports.routes.js";
import adminRoutes      from "./routes/admin.routes.js";
import profileRoutes    from "./routes/profile.routes.js";

export const app = express();

// Vercel (and most cloud platforms) sit behind a reverse proxy.
// Trust the first hop so express-rate-limit can read the real client IP
// from the X-Forwarded-For header instead of throwing a validation error.
app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(requestId);
app.use(securityHeaders);
app.use(corsMiddleware);
if (!isProd) app.use(morgan("dev"));
app.use(cookieParser());
app.use(express.json({ limit: "256kb" }));

// Parse encrypted session cookie on every request — attaches req.session or null
app.use(sessionMiddleware);

app.use("/api", ipRateLimiter);
app.use("/api", csrfOriginCheck);
app.use("/api", (req, res, next) =>
  ["POST", "PUT", "DELETE", "PATCH"].includes(req.method) ? writeRateLimiter(req, res, next) : next(),
);

app.use("/api/auth",    authRoutes);
app.use("/api/posts",   postsRoutes);
app.use("/api/posts",   engagementRoutes);
app.use("/api/posts",   reportsRoutes);
app.use("/api/admin",   adminRoutes);
app.use("/api/profile", profileRoutes);

app.get("/healthz", (req, res) => res.json({ ok: true }));

app.use(notFoundHandler);
app.use(errorHandler);
