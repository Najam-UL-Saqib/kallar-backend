import { createHmac, timingSafeEqual } from "node:crypto";
import { env, isProd } from "../config/env.js";

const COOKIE_NAME = "kallar_admin_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12h, sliding refresh on use

function sign(payload) {
  return createHmac("sha256", env.adminSessionSecret).update(payload).digest("base64url");
}

function safeEqual(a, b) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function issueAdminSession(res) {
  const issuedAt = Date.now();
  const payload = `admin.${issuedAt}`;
  const token = `${payload}.${sign(payload)}`;
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS,
  });
}

export function clearAdminSession(res) {
  res.clearCookie(COOKIE_NAME, { path: "/" });
}

function verify(token) {
  if (!token || typeof token !== "string") return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [scope, issuedAtStr, sig] = parts;
  const issuedAt = Number(issuedAtStr);
  if (scope !== "admin" || !Number.isFinite(issuedAt)) return false;
  if (!safeEqual(sig, sign(`${scope}.${issuedAtStr}`))) return false;
  return Date.now() - issuedAt <= SESSION_TTL_MS;
}

export function requireAdmin(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!verify(token)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  // Sliding refresh: re-issue on every authenticated request.
  issueAdminSession(res);
  next();
}
