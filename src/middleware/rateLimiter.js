import { randomUUID } from "node:crypto";
import rateLimit from "express-rate-limit";
import { supabaseAdmin } from "../config/supabase.js";
import { HttpError } from "./errorHandler.js";

// ─── IP-level guards ──────────────────────────────────────────────────────────

// Broad limiter for all /api routes — catches bots and raw floods
export const ipRateLimiter = rateLimit({
  windowMs: 60_000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests — slow down." },
});

// Tighter limiter for write endpoints (POST/PUT/DELETE) only
export const writeRateLimiter = rateLimit({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many write requests — slow down." },
});

// ─── Request tracing ──────────────────────────────────────────────────────────

// Attaches a unique ID to every request for forensic log correlation
export function requestId(req, res, next) {
  req.id = randomUUID();
  res.setHeader("X-Request-ID", req.id);
  next();
}

// ─── Per-device per-action limiter (DB-backed) ────────────────────────────────

const LIMITS = {
  like:    { windowMs: 10_000,       max: 10 },
  comment: { windowMs: 60_000,       max: 5  },
  share:   { windowMs: 60_000,       max: 10 },
  post:    { windowMs: 60_000,       max: 5  },
  report:  { windowMs: 60 * 60_000,  max: 5  },
  listing: { windowMs: 60_000,       max: 5  },
  rsvp:    { windowMs: 10_000,       max: 10 },
  directorySubmit: { windowMs: 24 * 60 * 60_000, max: 3 },
};

const CLEANUP_MAX_AGE_MS = 60 * 60_000;

// In-memory short-circuit: tracks recent actions to avoid a DB round-trip
// on every request. Key = `${userId}:${action}`, value = hit count in window.
// This is a best-effort first gate; the DB check below is authoritative.
const _memWindow = new Map(); // key → { count, expiresAt }

function memCheck(userId, action) {
  const { windowMs, max } = LIMITS[action];
  const key = `${userId}:${action}`;
  const now = Date.now();
  const entry = _memWindow.get(key);
  if (!entry || now > entry.expiresAt) {
    _memWindow.set(key, { count: 1, expiresAt: now + windowMs });
    return false; // not limited
  }
  entry.count += 1;
  // Only block when comfortably above the limit — DB is authoritative at the edge
  return entry.count > max * 2;
}

// Purge expired in-memory entries periodically (every 5 min)
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of _memWindow) if (now > v.expiresAt) _memWindow.delete(k);
}, 5 * 60_000).unref();

// Read-only: throws if the user is already at/over the limit for this
// action, but doesn't consume a slot itself. Split out from
// recordRateLimitEvent so a caller whose actual write can still fail
// (e.g. a DB insert erroring out) can check-then-act-then-record instead
// of recording before knowing whether the action actually succeeded —
// otherwise failed attempts quietly eat into the user's quota.
export async function checkRateLimit(userId, action) {
  const { windowMs, max } = LIMITS[action];
  const since = new Date(Date.now() - windowMs).toISOString();

  const { count, error: countErr } = await supabaseAdmin
    .from("rate_limit_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("action", action)
    .gte("created_at", since);
  if (countErr) throw new HttpError(500, countErr.message);

  if ((count ?? 0) >= max) {
    throw new HttpError(429, `Too many ${action} requests — please slow down and try again shortly.`);
  }
}

export async function recordRateLimitEvent(userId, action) {
  const { error: insErr } = await supabaseAdmin
    .from("rate_limit_events")
    .insert({ user_id: userId, action });
  if (insErr) throw new HttpError(500, insErr.message);

  // Probabilistic cleanup (2% chance) to keep the table lean
  if (Math.random() < 0.02) {
    supabaseAdmin
      .from("rate_limit_events")
      .delete()
      .lt("created_at", new Date(Date.now() - CLEANUP_MAX_AGE_MS).toISOString())
      .then(() => {})
      .catch(() => {});
  }
}

// Convenience wrapper for the common case: check, then immediately record
// (i.e. the action is assumed to happen right after this call succeeds).
// Most call sites use this unchanged; anything whose write can still fail
// after the check should use checkRateLimit + recordRateLimitEvent directly
// so a failed write doesn't burn a quota slot.
export async function enforceRateLimit(userId, action) {
  // Fast in-memory gate — avoids DB for clear spammers
  if (memCheck(userId, action)) {
    throw new HttpError(429, `Too many ${action} requests — please slow down.`);
  }
  await checkRateLimit(userId, action);
  await recordRateLimitEvent(userId, action);
}
