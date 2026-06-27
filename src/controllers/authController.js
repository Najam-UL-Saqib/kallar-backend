import { env } from "../config/env.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { upsertProfile } from "../services/profileService.js";
import { writeSessionCookie, clearSessionCookie } from "../middleware/session.js";

const GOOGLE_AUTH_URL     = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL    = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";

// Step 1 — redirect browser to Google consent screen
export const googleLogin = (req, res) => {
  const params = new URLSearchParams({
    client_id:     env.googleClientId,
    redirect_uri:  env.googleCallbackUrl,
    response_type: "code",
    scope:         "openid email profile",
    access_type:   "online",
    prompt:        "select_account",
  });
  res.redirect(`${GOOGLE_AUTH_URL}?${params}`);
};

// Step 2 — Google redirects here with ?code=...
// Exchange code → tokens → user info → session cookie → redirect to frontend
export const googleCallback = asyncHandler(async (req, res) => {
  const { code } = req.query;
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
  if (!tokenRes.ok) {
    console.error("[auth] token exchange failed:", tokens);
    return res.redirect(`${env.frontendUrl}?auth=error`);
  }

  // Fetch Google user info
  const userRes  = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const gUser = await userRes.json();
  if (!userRes.ok || !gUser.sub) {
    console.error("[auth] userinfo failed:", gUser);
    return res.redirect(`${env.frontendUrl}?auth=error`);
  }

  // Create or update local profile
  const profile = await upsertProfile({
    id:         gUser.sub,
    email:      gUser.email,
    name:       gUser.name,
    avatar_url: gUser.picture,
  });

  // Issue encrypted session cookie — no sensitive data leaves the server
  writeSessionCookie(res, {
    userId:    profile.id,
    email:     profile.email,
    name:      profile.name,
    avatarUrl: profile.avatar_url,
  });

  res.redirect(env.frontendUrl);
});

// Clear the session cookie
export const logout = (req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
};

// Returns current session data (null if not logged in) — safe for the frontend to call
export const me = (req, res) => {
  res.json(req.session ?? null);
};
