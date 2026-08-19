// Simple in-memory "once per UTC calendar day" cache for content that should
// look identical to every visitor on a given day (Ayah/Hadith/APOD/On This
// Day). Resets on cold start — that just costs one extra upstream fetch, it's
// not a correctness issue, so no need for anything heavier than a Map here.
const _store = new Map(); // key -> { date, value }

function todayKey() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
}

// A failed fetcher() throws before the cache is written, so a bad upstream
// response is never cached — the next request just retries.
export async function getOrFetchDaily(key, fetcher) {
  const today = todayKey();
  const entry = _store.get(key);
  if (entry && entry.date === today) return entry.value;

  const value = await fetcher();
  _store.set(key, { date: today, value });
  return value;
}

// Drop a cached entry immediately — used after an admin edits content that
// this cache is holding (e.g. trivia questions), so the change is visible
// on the next request instead of waiting for the UTC day to roll over.
export function invalidateDaily(key) {
  _store.delete(key);
}
