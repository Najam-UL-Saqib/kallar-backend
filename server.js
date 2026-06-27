import { app } from "./src/app.js";
import { env } from "./src/config/env.js";
import { init as initCache, sync as syncCache } from "./src/cache/postCache.js";

const SYNC_INTERVAL_MS = 60 * 60_000; // 1 hour — DB is source of truth

initCache()
  .then(() => {
    // Start periodic sync after initial load
    setInterval(() => {
      syncCache().catch((e) => console.error("[cache] sync error:", e));
    }, SYNC_INTERVAL_MS).unref();

    app.listen(env.port, () => {
      console.log(`kallar-backend listening on port ${env.port}`);
    });
  })
  .catch((e) => {
    // Cache failure is non-fatal — services fall back to DB queries
    console.error("[cache] init error:", e);
    app.listen(env.port, () => {
      console.log(`kallar-backend listening on port ${env.port} (cache unavailable)`);
    });
  });
