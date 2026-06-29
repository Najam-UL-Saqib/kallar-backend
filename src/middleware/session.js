import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { env, isProd } from "../config/env.js";

const COOKIE_NAME    = "tks_session_v2";
const MAX_AGE_MS     = 1000 * 60 * 60 * 24 * 30; // 30 days
const ALG            = "aes-256-gcm";

// Derive a 32-byte key from the existing secret — never hits the wire
const KEY = createHash("sha256").update(env.deviceTokenSecret + ":session").digest();

function encrypt(obj) {
  const plain = JSON.stringify(obj);
  const iv    = randomBytes(12);
  const c     = createCipheriv(ALG, KEY, iv);
  const body  = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  const tag   = c.getAuthTag();
  return Buffer.concat([iv, tag, body]).toString("base64url");
}

function decrypt(token) {
  try {
    const buf  = Buffer.from(token, "base64url");
    if (buf.length < 29) return null;
    const iv   = buf.subarray(0, 12);
    const tag  = buf.subarray(12, 28);
    const body = buf.subarray(28);
    const d    = createDecipheriv(ALG, KEY, iv);
    d.setAuthTag(tag);
    return JSON.parse(Buffer.concat([d.update(body), d.final()]).toString("utf8"));
  } catch {
    return null;
  }
}

export function writeSessionCookie(res, data) {
  res.cookie(COOKIE_NAME, encrypt(data), {
    httpOnly: true,
    secure:   isProd,
    // "none" allows the cookie to be sent on cross-site requests (frontend ↔ backend on
    // different domains in production). Requires secure:true, which Vercel provides.
    sameSite: isProd ? "none" : "lax",
    path:     "/",
    maxAge:   MAX_AGE_MS,
  });
}

export function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME, {
    path:     "/",
    httpOnly: true,
    secure:   isProd,
    sameSite: isProd ? "none" : "lax",
  });
}

// Attaches req.session (plain object) or null — runs on every request
export function sessionMiddleware(req, res, next) {
  req.session = null;
  const raw = req.cookies?.[COOKIE_NAME];
  if (raw) req.session = decrypt(raw);
  next();
}
