// Vercel serverless entry point.
// Vercel calls this as a function — no app.listen() needed.
// The in-memory cache warms up on cold start and persists for the lifetime
// of the warm instance. setInterval is omitted (serverless instances are
// short-lived; the hourly sync is irrelevant here).

import { app } from "../src/app.js";
import { init as initCache } from "../src/cache/postCache.js";

initCache().catch((e) => console.error("[cache] init error:", e));

export default app;
