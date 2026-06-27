import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "node:crypto";
import { env, isProd } from "../config/env.js";

const COOKIE_NAME = "tks_device";
const COOKIE_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 365 * 5; // 5 years
const TOKEN_TTL_MS    = 1000 * 60 * 60 * 24 * 90;        // re-issue after 90 days
const ALG = "aes-256-gcm";

// Derive a stable 32-byte AES key from the secret (any length → fixed 32 bytes)
const KEY = createHash("sha256").update(env.deviceTokenSecret).digest();

// Layout: 12-byte IV | 16-byte GCM auth tag | ciphertext  → base64url
function encrypt(plaintext) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALG, KEY, iv);
  const body = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag  = cipher.getAuthTag();
  return Buffer.concat([iv, tag, body]).toString("base64url");
}

function decrypt(token) {
  try {
    const buf = Buffer.from(token, "base64url");
    if (buf.length < 29) return null; // 12 + 16 + at least 1 byte of content
    const iv   = buf.subarray(0, 12);
    const tag  = buf.subarray(12, 28);
    const body = buf.subarray(28);
    const decipher = createDecipheriv(ALG, KEY, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8");
  } catch {
    // Wrong key, truncated, or tampered — treat as invalid
    return null;
  }
}

// Token payload: "deviceId.issuedAt" — device_id never appears in plain text
function makeToken(deviceId, issuedAt = Date.now()) {
  return encrypt(`${deviceId}.${issuedAt}`);
}

function verifyToken(token) {
  if (!token || typeof token !== "string") return null;
  const plain = decrypt(token);
  if (!plain) return null;
  // Split on last "." so UUIDs containing "-" don't interfere
  const cut = plain.lastIndexOf(".");
  if (cut === -1) return null;
  const deviceId  = plain.slice(0, cut);
  const issuedAt  = Number(plain.slice(cut + 1));
  if (!deviceId || !Number.isFinite(issuedAt)) return null;
  return { deviceId, expired: Date.now() - issuedAt > TOKEN_TTL_MS };
}

function writeDeviceCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE_MS,
  });
}

export function deviceIdMiddleware(req, res, next) {
  const verified = verifyToken(req.cookies?.[COOKIE_NAME]);

  if (verified) {
    if (verified.expired) {
      // Re-encrypt with a fresh timestamp so the rotation window resets
      writeDeviceCookie(res, makeToken(verified.deviceId));
    }
    req.deviceId = verified.deviceId;
    return next();
  }

  // No cookie, invalid, or tampered — issue a fresh identity
  const deviceId = `d-${randomUUID()}`;
  writeDeviceCookie(res, makeToken(deviceId));
  req.deviceId = deviceId;
  next();
}
