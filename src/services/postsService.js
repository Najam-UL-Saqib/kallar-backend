import { supabaseAdmin } from "../config/supabase.js";
import { HttpError } from "../middleware/errorHandler.js";
import { sanitizeText } from "../middleware/sanitize.js";
import { MAX_USER_POSTS_PER_DAY } from "../utils/validators.js";
import * as cache from "../cache/postCache.js";

// Used for DB reads — device_id included so we can compute is_mine, but it's
// stripped before the response reaches the client.
const FETCH_COLUMNS =
  "id, author_name, title, content, image_url, category, source, created_at, device_id";

const DAY_MS = 24 * 60 * 60 * 1000;

function countBy(rows, key) {
  const acc = {};
  for (const r of rows ?? []) acc[r[key]] = (acc[r[key]] ?? 0) + 1;
  return acc;
}

// Strips device_id, attaches is_mine + liked for each post.
// One DB query for all liked flags regardless of page size.
async function buildPublicPosts(rawPosts, deviceId) {
  if (rawPosts.length === 0) return [];
  const ids = rawPosts.map((p) => p.id);
  const likedSet = new Set();
  if (deviceId) {
    const { data } = await supabaseAdmin
      .from("likes")
      .select("post_id")
      .eq("device_id", deviceId)
      .in("post_id", ids);
    (data ?? []).forEach((r) => likedSet.add(r.post_id));
  }
  return rawPosts.map(({ device_id, ...rest }) => ({
    ...rest,
    liked: likedSet.has(rest.id),
    is_mine: !!device_id && device_id === deviceId,
  }));
}

export async function listPosts({ page = 0, pageSize = 5, category, search, deviceId }) {
  if (cache.isReady()) {
    // Cache already has stats embedded; device_id present for is_mine
    const raw = cache.getCachedPosts({ page, pageSize, category, search });
    return buildPublicPosts(raw, deviceId);
  }

  // Cold-start DB fallback — bulk-fetch counts, then liked, 4 queries total
  const from = page * pageSize;
  const to = from + pageSize - 1;
  let query = supabaseAdmin
    .from("posts")
    .select(FETCH_COLUMNS)
    .order("created_at", { ascending: false })
    .range(from, to);
  if (category) query = query.eq("category", category);
  if (search) query = query.or(`title.ilike.%${search}%,content.ilike.%${search}%`);
  const { data, error } = await query;
  if (error) throw new HttpError(500, error.message);

  const ids = (data ?? []).map((p) => p.id);
  const [likeData, commentData, shareData] = await Promise.all([
    supabaseAdmin.from("likes").select("post_id").in("post_id", ids),
    supabaseAdmin.from("comments").select("post_id").in("post_id", ids),
    supabaseAdmin.from("shares").select("post_id").in("post_id", ids),
  ]);
  const likes = countBy(likeData.data, "post_id");
  const comments = countBy(commentData.data, "post_id");
  const shares = countBy(shareData.data, "post_id");
  const withStats = (data ?? []).map((p) => ({
    ...p,
    likes: likes[p.id] ?? 0,
    comments: comments[p.id] ?? 0,
    shares: shares[p.id] ?? 0,
  }));
  return buildPublicPosts(withStats, deviceId);
}

export async function getPost(id, deviceId) {
  const { data, error } = await supabaseAdmin
    .from("posts")
    .select(FETCH_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new HttpError(500, error.message);
  if (!data) throw new HttpError(404, "Post not found");

  const cached = cache.getCachedStats(id);
  const withStats = cached
    ? { ...data, likes: cached.likes, comments: cached.comments, shares: cached.shares }
    : await (async () => {
        const [lk, cm, sh] = await Promise.all([
          supabaseAdmin.from("likes").select("id", { count: "exact", head: true }).eq("post_id", id),
          supabaseAdmin.from("comments").select("id", { count: "exact", head: true }).eq("post_id", id),
          supabaseAdmin.from("shares").select("id", { count: "exact", head: true }).eq("post_id", id),
        ]);
        return { ...data, likes: lk.count ?? 0, comments: cm.count ?? 0, shares: sh.count ?? 0 };
      })();

  const [result] = await buildPublicPosts([withStats], deviceId);
  return result;
}

export async function updateUserPost(postId, deviceId, { title, content, category }) {
  // Verify ownership — one small lookup
  const { data: existing, error: selErr } = await supabaseAdmin
    .from("posts")
    .select("device_id, source")
    .eq("id", postId)
    .maybeSingle();
  if (selErr) throw new HttpError(500, selErr.message);
  if (!existing) throw new HttpError(404, "Post not found");
  if (existing.source === "admin") throw new HttpError(403, "Admin posts cannot be edited here");
  if (existing.device_id !== deviceId) throw new HttpError(403, "You can only edit your own posts");

  const updates = {
    title: title ? sanitizeText(title) : null,
    content: sanitizeText(content),
    category,
  };
  const { data, error } = await supabaseAdmin
    .from("posts")
    .update(updates)
    .eq("id", postId)
    .select(FETCH_COLUMNS)
    .single();
  if (error) throw new HttpError(500, error.message);

  cache.updatePost(postId, updates);
  const [result] = await buildPublicPosts([data], deviceId);
  return result;
}

async function countRecentUserPosts(deviceId) {
  const since = new Date(Date.now() - DAY_MS).toISOString();
  const { count, error } = await supabaseAdmin
    .from("posts")
    .select("id", { count: "exact", head: true })
    .eq("device_id", deviceId)
    .gte("created_at", since);
  if (error) throw new HttpError(500, error.message);
  return count ?? 0;
}

export async function createUserPost(deviceId, { title, content, category, image_url }) {
  const recentCount = await countRecentUserPosts(deviceId);
  if (recentCount >= MAX_USER_POSTS_PER_DAY) {
    throw new HttpError(429, `You can only create ${MAX_USER_POSTS_PER_DAY} posts per day.`);
  }

  const { data, error } = await supabaseAdmin
    .from("posts")
    .insert({
      title: title ? sanitizeText(title) : null,
      content: sanitizeText(content),
      category,
      image_url: image_url ?? null,
      device_id: deviceId,
      source: "user",
      author_name: "Community Member",
    })
    .select(FETCH_COLUMNS)
    .single();
  if (error) throw new HttpError(500, error.message);

  cache.addPost(data); // stores device_id internally
  const { device_id, ...rest } = data;
  return { ...rest, likes: 0, comments: 0, shares: 0, liked: false, is_mine: true };
}
