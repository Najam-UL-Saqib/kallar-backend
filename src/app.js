import express from "express";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import { isProd } from "./config/env.js";
import { securityHeaders, corsMiddleware } from "./middleware/security.js";
import { ipRateLimiter, writeRateLimiter, requestId } from "./middleware/rateLimiter.js";
import { deviceIdMiddleware } from "./middleware/deviceId.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";

import postsRoutes from "./routes/posts.routes.js";
import engagementRoutes from "./routes/engagement.routes.js";
import reportsRoutes from "./routes/reports.routes.js";
import deviceRoutes from "./routes/device.routes.js";
import adminRoutes from "./routes/admin.routes.js";

export const app = express();

app.disable("x-powered-by");
app.use(requestId);
app.use(securityHeaders);
app.use(corsMiddleware);
if (!isProd) app.use(morgan("dev"));
app.use(cookieParser());
app.use(express.json({ limit: "256kb" }));
app.use("/api", ipRateLimiter);
// Stricter limit for state-mutating requests
app.use("/api", (req, res, next) =>
  ["POST", "PUT", "DELETE", "PATCH"].includes(req.method) ? writeRateLimiter(req, res, next) : next(),
);
app.use("/api/posts", deviceIdMiddleware);
app.use("/api/device", deviceIdMiddleware);

app.use("/api/posts", postsRoutes);
app.use("/api/posts", engagementRoutes);
app.use("/api/posts", reportsRoutes);
app.use("/api/device", deviceRoutes);
app.use("/api/admin", adminRoutes);

app.get("/healthz", (req, res) => res.json({ ok: true }));

app.use(notFoundHandler);
app.use(errorHandler);
