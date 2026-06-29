import helmet from "helmet";
import cors from "cors";
import { env, isProd } from "../config/env.js";

export const securityHeaders = helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      defaultSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
  crossOriginResourcePolicy: { policy: "same-site" },
  referrerPolicy: { policy: "no-referrer" },
});

export const corsMiddleware = cors({
  origin: env.frontendUrl,
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
});

// CSRF protection via Origin header check.
//
// With sameSite:"none" in production the session cookie is sent on all cross-site requests,
// including ones from attacker-controlled pages. Browsers always include the Origin header on
// cross-site requests, so rejecting an Origin that doesn't match the allowed frontend blocks
// the attack before any state mutation occurs.
//
// Requests with NO Origin header (Postman, curl, server-side) are allowed — they cannot carry
// the user's httpOnly session cookie and therefore cannot perform CSRF.
export function csrfOriginCheck(req, res, next) {
  // Only enforce in production — dev machines use different ports/IPs
  // and don't have real cross-site attack surfaces.
  if (!isProd) return next();
  if (!["POST", "PUT", "DELETE", "PATCH"].includes(req.method)) return next();

  const origin = req.headers.origin;
  if (origin && origin !== env.frontendUrl) {
    console.warn("[csrf] rejected request from origin:", origin);
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
}
