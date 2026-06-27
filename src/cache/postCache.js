import { supabaseAdmin } from "../config/supabase.js";

const CACHE_MAX = 50;
// device_id is stored internally for is_mine computation — never sent to clients
const CACHE_COLUMNS = "id, author_name, title, content, image_url, category, source, created_at, device_id";

// Mutable module-level state — single process instance
const _posts = [];                     // Post[], sorted newest-first, max CACHE_MAX
const _stats = new Map();              // postId → { likes, comments, shares }
let _ready = false;

function countBy(rows, key) {
  const acc = {};
  for (const r of rows ?? []) acc[r[key]] = (acc[r[key]] ?? 0) + 1;
  return acc;
}

async function _load() {
  const { data: posts, error } = await supabaseAdmin
    .from("posts")
    .select(CACHE_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(CACHE_MAX);

  if (error || !posts) {
    console.error("[cache] load failed:", error?.message ?? "no data");
    return;
  }

  const ids = posts.map((p) => p.id);

  // 3 bulk queries to count engagements — much cheaper than 50×3 individual counts
  const [likeRes, commentRes, shareRes] = await Promise.all([
    supabaseAdmin.from("likes").select("post_id").in("post_id", ids),
    supabaseAdmin.from("comments").select("post_id").in("post_id", ids),
    supabaseAdmin.from("shares").select("post_id").in("post_id", ids),
  ]);

  const likes    = countBy(likeRes.data,    "post_id");
  const comments = countBy(commentRes.data, "post_id");
  const shares   = countBy(shareRes.data,   "post_id");

  _posts.length = 0;
  _stats.clear();
  _posts.push(...posts);
  for (const id of ids) {
    _stats.set(id, {
      likes:    likes[id]    ?? 0,
      comments: comments[id] ?? 0,
      shares:   shares[id]   ?? 0,
    });
  }
  _ready = true;
}

// ─── Lifecycle ───────────────────────────────────────────────────────────────

export async function init() {
  await _load();
  console.log(`[cache] initialized — ${_posts.length} posts`);
}

// DB is source of truth; sync hourly to reconcile any drift
export async function sync() {
  await _load();
  console.log(`[cache] synced — ${_posts.length} posts`);
}

export const isReady = () => _ready;

// ─── Reads ────────────────────────────────────────────────────────────────────

// Returns posts with aggregate stats embedded. `liked` is omitted here —
// it's per-device and must be resolved by the caller with a single DB query.
export function getCachedPosts({ page = 0, pageSize = 5, category, search }) {
  if (!_ready) return null; // caller falls back to DB

  let list = _posts;
  if (category) list = list.filter((p) => p.category === category);
  if (search) {
    const q = search.toLowerCase();
    list = list.filter(
      (p) => p.title?.toLowerCase().includes(q) || p.content.toLowerCase().includes(q),
    );
  }

  return list.slice(page * pageSize, page * pageSize + pageSize).map((p) => {
    const s = _stats.get(p.id) ?? { likes: 0, comments: 0, shares: 0 };
    return { ...p, likes: s.likes, comments: s.comments, shares: s.shares };
  });
}

// Returns aggregate counts only — kept for single-post stats lookups
export function getCachedStats(postId) {
  if (!_ready) return null;
  return _stats.get(postId) ?? null;
}

// ─── Writes ──────────────────────────────────────────────────────────────────

export function addPost(post) {
  _posts.unshift(post);
  _stats.set(post.id, { likes: 0, comments: 0, shares: 0 });
  if (_posts.length > CACHE_MAX) {
    const evicted = _posts.pop();
    _stats.delete(evicted.id);
  }
}

// Used by admin update — patches mutable fields in-place
export function updatePost(postId, updates) {
  const p = _posts.find((p) => p.id === postId);
  if (p) Object.assign(p, updates);
}

export function removePost(postId) {
  const idx = _posts.findIndex((p) => p.id === postId);
  if (idx !== -1) _posts.splice(idx, 1);
  _stats.delete(postId);
}

export function updateLike(postId, delta) {
  const s = _stats.get(postId);
  if (s) s.likes = Math.max(0, s.likes + delta);
}

export function updateComment(postId) {
  const s = _stats.get(postId);
  if (s) s.comments += 1;
}

export function updateShare(postId) {
  const s = _stats.get(postId);
  if (s) s.shares += 1;
}
