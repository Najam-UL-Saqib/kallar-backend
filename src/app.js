import express from "express";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import { isProd } from "./config/env.js";
import { securityHeaders, corsMiddleware, csrfOriginCheck } from "./middleware/security.js";
import { ipRateLimiter, writeRateLimiter, requestId } from "./middleware/rateLimiter.js";
import { sessionMiddleware } from "./middleware/session.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";

import authRoutes          from "./routes/auth.routes.js";
import postsRoutes         from "./routes/posts.routes.js";
import engagementRoutes    from "./routes/engagement.routes.js";
import reportsRoutes       from "./routes/reports.routes.js";
import adminRoutes         from "./routes/admin.routes.js";
import profileRoutes       from "./routes/profile.routes.js";
import notificationsRoutes from "./routes/notifications.routes.js";
import directoryRoutes     from "./routes/directory.routes.js";

export const app = express();

app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(requestId);
app.use(securityHeaders);
app.use(corsMiddleware);
if (!isProd) app.use(morgan("dev"));
app.use(cookieParser());
app.use(express.json({ limit: "256kb" }));
app.use(sessionMiddleware);

app.use("/api", ipRateLimiter);
app.use("/api", csrfOriginCheck);
app.use("/api", (req, res, next) =>
  ["POST", "PUT", "DELETE", "PATCH"].includes(req.method) ? writeRateLimiter(req, res, next) : next(),
);

app.use("/api/auth",          authRoutes);
app.use("/api/posts",         postsRoutes);
app.use("/api/posts",         engagementRoutes);
app.use("/api/posts",         reportsRoutes);
app.use("/api/admin",         adminRoutes);
app.use("/api/profile",       profileRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/directory",     directoryRoutes);

app.get("/healthz", (req, res) => res.json({ ok: true }));

app.use(notFoundHandler);
app.use(errorHandler);
