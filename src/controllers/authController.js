import { randomBytes, createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../config/env.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { upsertProfile } from "../services/profileService.js";
import { writeSessionCookie, clearSessionCookie } from "../middleware/session.js";

const GOOGLE_AUTH_URL     = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL    = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";

// CSRF state is a signed nonce — no cookie required.
// This eliminates the cross-domain cookie dependency entirely: the state value
// is self-verifiable via HMAC, so it survives any redirect chain and any cookie
// policy without storing anything server-side.
function generateState() {
  const nonce = randomBytes(24).toString("base64url");
  const sig   = createHmac("sha256", env.deviceTokenSecret).update(nonce).digest("base64url");
  return `${nonce}.${sig}`;
}

function verifyState(state) {
  if (!state || !state.includes(".")) return false;
  const dot   = state.lastIndexOf(".");
  const nonce = state.slice(0, dot);
  const sig   = state.slice(dot + 1);
  const expected = createHmac("sha256", env.deviceTokenSecret).update(nonce).digest("base64url");
  try {
    return timingSafeEqual(Buffer.from(sig, "base64url"), Buffer.from(expected, "base64url"));
  } catch {
    return false;
  }
}

// Step 1 — redirect browser to Google consent screen with a signed CSRF state token
export const googleLogin = (req, res) => {
  const state = generateState();

  const params = new URLSearchParams({
    client_id:     env.googleClientId,
    redirect_uri:  env.googleCallbackUrl,
    response_type: "code",
    scope:         "openid email profile",
    access_type:   "online",
    prompt:        "select_account",
    state,
  });
  res.redirect(`${GOOGLE_AUTH_URL}?${params}`);
};

// Step 2 — Google redirects here with ?code=...&state=...
export const googleCallback = asyncHandler(async (req, res) => {
  const { code, state } = req.query;

  // CSRF check: verify the HMAC signature on the state — no cookie lookup needed
  if (!verifyState(state)) {
    console.warn("[auth] OAuth state verification failed — possible CSRF attempt");
    return res.redirect(`${env.frontendUrl}?auth=error`);
  }

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
