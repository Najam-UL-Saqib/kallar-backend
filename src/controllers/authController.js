import { randomBytes } from "node:crypto";
import { env, isProd } from "../config/env.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { upsertProfile } from "../services/profileService.js";
import { writeSessionCookie, clearSessionCookie } from "../middleware/session.js";

const GOOGLE_AUTH_URL     = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL    = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";

const STATE_COOKIE = "oauth_state";
const STATE_MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes — enough for the user to complete login

function writeStateCookie(res, state) {
  res.cookie(STATE_COOKIE, state, {
    httpOnly: true,
    secure:   isProd,
    // lax is fine here: the callback is a top-level GET navigation (Google → backend),
    // which lax allows. We do NOT need "none" for this short-lived cookie.
    sameSite: "lax",
    path:     "/api/auth",
    maxAge:   STATE_MAX_AGE_MS,
  });
}

// Step 1 — redirect browser to Google consent screen with a CSRF state token
export const googleLogin = (req, res) => {
  const state = randomBytes(24).toString("base64url"); // unguessable random value
  writeStateCookie(res, state);

  const params = new URLSearchParams({
    client_id:     env.googleClientId,
    redirect_uri:  env.googleCallbackUrl,
    response_type: "code",
    scope:         "openid email profile",
    access_type:   "online",
    prompt:        "select_account",
    state,                              // sent to Google, returned in callback
  });
  res.redirect(`${GOOGLE_AUTH_URL}?${params}`);
};

// Step 2 — Google redirects here with ?code=...&state=...
export const googleCallback = asyncHandler(async (req, res) => {
  const { code, state } = req.query;
  const savedState = req.cookies?.[STATE_COOKIE];

  // CSRF check: state must match what we set in the cookie
  if (!state || !savedState || state !== savedState) {
    console.warn("[auth] OAuth state mismatch — possible CSRF attempt");
    return res.redirect(`${env.frontendUrl}?auth=error`);
  }
  // Clear the one-time state cookie immediately
  res.clearCookie(STATE_COOKIE, { path: "/api/auth" });

  if (!code) return res.redirect(`${env.frontendUrl}?auth=error`);

  // Exchange authorisation code for access token
  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:    new URLSearchParams({
      code,
      client_id:     env.googleClientId,
      client_secret: env.googleClientSecret,
      redirect_uri:  env.googleCallbackUrl,
      grant_type:    "authorization_code",
    }),
  });
  const tokens = await tokenRes.json();
  if (!tokenRes.ok || !tokens.access_token) {
    console.error("[auth] token exchange failed:", tokens.error);
    return res.redirect(`${env.frontendUrl}?auth=error`);
  }

  // Fetch verified user info from Google
  const userRes = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const gUser = await userRes.json();
  if (!userRes.ok || !gUser.sub || !gUser.email) {
    console.error("[auth] userinfo failed:", gUser);
    return res.redirect(`${env.frontendUrl}?auth=error`);
  }

  // Only allow verified email addresses
  if (!gUser.email_verified) {
    console.warn("[auth] unverified email rejected:", gUser.email);
    return res.redirect(`${env.frontendUrl}?auth=error`);
  }

  // Create or update local profile — Google sub is our stable user ID
  const profile = await upsertProfile({
    id:         gUser.sub,
    email:      gUser.email,
    name:       gUser.name,
    avatar_url: gUser.picture,
  });

  // Issue encrypted session cookie — Google tokens never leave the server
  writeSessionCookie(res, {
    userId:    profile.id,
    email:     profile.email,
    name:      profile.name,
    avatarUrl: profile.avatar_url,
  });

  res.redirect(env.frontendUrl);
});

export const logout = (req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
};

// Returns current session data (null if not logged in) — safe to expose
export const me = (req, res) => {
  res.json(req.session ?? null);
};
