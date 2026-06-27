import test from "node:test";
import assert from "node:assert/strict";
import process from "node:process";

process.env.NODE_ENV = "test";
process.env.PORT = "4001";
process.env.FRONTEND_URL = "http://localhost:3000";
process.env.SUPABASE_URL = "http://localhost:54321";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
// Dummy scrypt hash for "test-only-password" — generated only for this test
// fixture, unrelated to any real admin credential.
process.env.ADMIN_PASSWORD_HASH =
  "0e5fe6e973751def35ffd265cf2717ff:14131792798efb367c6eb81c46472cc300e89f2b83f8216c372187c91c4e23c5ec75141a32141b27f7e00e3c13d031ee11bc202c028da2257c65cfde9464b825";
process.env.ADMIN_SESSION_SECRET = "test-admin-session-secret";
process.env.DEVICE_TOKEN_SECRET = "test-device-token-secret";

const { app } = await import("../src/app.js");
const request = (await import("supertest")).default;

test("security headers are present", async () => {
  const res = await request(app).get("/healthz");
  assert.equal(res.status, 200);
  assert.equal(res.headers["x-content-type-options"], "nosniff");
  assert.equal(res.headers["x-powered-by"], undefined);
});

test("CORS only ever allows the configured frontend origin", async () => {
  const res = await request(app)
    .get("/healthz")
    .set("Origin", "https://evil.example.com");
  // cors() with a static origin string always replies with that one fixed
  // value — browsers reject the response when it doesn't match the page's
  // own origin, so a mismatching Origin header here proves evil.example.com
  // would be blocked client-side even though curl/supertest don't enforce it.
  assert.equal(res.headers["access-control-allow-origin"], "http://localhost:3000");
});

test("unknown routes return 404 JSON", async () => {
  const res = await request(app).get("/api/does-not-exist");
  assert.equal(res.status, 404);
  assert.equal(res.body.error, "Not found");
});

test("creating a post rejects content over 1000 characters", async () => {
  const res = await request(app)
    .post("/api/posts")
    .send({ content: "a".repeat(1001) });
  assert.equal(res.status, 400);
});

test("creating a post rejects empty content", async () => {
  const res = await request(app).post("/api/posts").send({ content: "" });
  assert.equal(res.status, 400);
});

test("admin routes require auth", async () => {
  const res = await request(app).get("/api/admin/stats");
  assert.equal(res.status, 401);
});

test("admin login rejects a wrong password", async () => {
  const res = await request(app).post("/api/admin/login").send({ password: "wrong" });
  assert.equal(res.status, 401);
});

test("admin login requires a password field", async () => {
  const res = await request(app).post("/api/admin/login").send({});
  assert.equal(res.status, 400);
});
