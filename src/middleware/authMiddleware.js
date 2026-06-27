import { HttpError } from "./errorHandler.js";

// Requires a valid session cookie — set by the Google OAuth callback.
// Attaches req.session, req.userId, req.userName for downstream use.
export function requireAuth(req, res, next) {
  if (!req.session?.userId) return next(new HttpError(401, "Login required"));
  req.userId   = req.session.userId;
  req.userName = req.session.name || "Community Member";
  next();
}

// Non-fatal: attaches user data if a valid session exists, skips if not.
// Used on read routes so that is_mine / liked are computed for logged-in users.
export function optionalAuth(req, res, next) {
  if (req.session?.userId) {
    req.userId   = req.session.userId;
    req.userName = req.session.name || "Community Member";
  }
  next();
}
