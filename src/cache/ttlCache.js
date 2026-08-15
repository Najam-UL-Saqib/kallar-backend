// Simple in-memory TTL cache for content that should refresh periodically
// (not "once per day" like dailyContentCache.js) — e.g. news headlines.
// Resets on cold start, same tradeoff as dailyContentCache.js: worst case is
// one extra upstream fetch, never a correctness issue.
const _store = new Map(); // key -> { expiresAt, value }

export async function getOrFetchWithTtl(key, ttlMs, fetcher) {
  const entry = _store.get(key);
  const now = Date.now();
  if (entry && now < entry.expiresAt) return entry.value;

  const value = await fetcher();
  _store.set(key, { expiresAt: now + ttlMs, value });
  return value;
}
