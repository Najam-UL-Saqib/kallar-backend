import { supabaseAdmin } from "../config/supabase.js";
import { HttpError } from "../middleware/errorHandler.js";
import { sanitizeText } from "../middleware/sanitize.js";
import { MAX_USER_POSTS_PER_DAY } from "../utils/validators.js";
import * as cache from "../cache/postCache.js";

const FETCH_COLUMNS =
  "id, author_name, title, content, image_url, category, source, created_at, user_id, views, pinned, event_date, poll_options";

const DAY_MS = 24 * 60 * 60 * 1000;

function countBy(rows, key) {
  const acc = {};
  for (const r of rows ?? []) acc[r[key]] = (acc[r[key]] ?? 0) + 1;
  return acc;
}

function extractHashtags(text) {
  const matches = text.match(/#[\w؀-ۿ]+/g) ?? [];
  return [...new Set(matches.map((t) => t.slice(1).toLowerCase()))];
}

async function buildPublicPosts(rawPosts, userId) {
  if (rawPosts.length === 0) return [];
  const ids = rawPosts.map((p) => p.id);

  const [likedData, bookmarkData] = await Promise.all([
    userId
      ? supabaseAdmin.from("likes").select("post_id").eq("user_id", userId).in("post_id", ids)
      : { data: [] },
    userId
      ? supabaseAdmin.from("bookmarks").select("post_id").eq("user_id", userId).in("post_id", ids)
      : { data: [] },
  ]);

  const likedSet    = new Set((likedData.data ?? []).map((r) => r.post_id));
  const bookmarkSet = new Set((bookmarkData.data ?? []).map((r) => r.post_id));

  return rawPosts.map(({ user_id, ...rest }) => ({
    ...rest,
    liked:      likedSet.has(rest.id),
    bookmarked: bookmarkSet.has(rest.id),
    is_mine:    !!user_id && user_id === userId,
  }));
}

async function attachStats(posts) {
  if (posts.length === 0) return posts;
  const ids = posts.map((p) => p.id);
  const [likeData, commentData, shareData] = await Promise.all([
    supabaseAdmin.from("likes").select("post_id").in("post_id", ids),
    supabaseAdmin.from("comments").select("post_id").in("post_id", ids),
    supabaseAdmin.from("shares").select("post_id").in("post_id", ids),
  ]);
  const lc = countBy(likeData.data,    "post_id");
  const cc = countBy(commentData.data, "post_id");
  const sc = countBy(shareData.data,   "post_id");
  return posts.map((p) => ({
    ...p,
    likes:    lc[p.id] ?? 0,
    comments: cc[p.id] ?? 0,
    shares:   sc[p.id]  ?? 0,
  }));
}

export async function listPosts({ page = 0, pageSize = 5, category, search, userId, sort = "newest", tag }) {
  const from = page * pageSize;

  // Trending sort bypasses the in-memory cache because it needs aggregation
  if (sort === "trending" || sort === "popular" || tag) {
    let query = supabaseAdmin
      .from("posts")
      .select(FETCH_COLUMNS)
      .range(from, from + pageSize - 1);

    if (category)             query = query.eq("category", category);
    if (search)               query = query.or(`title.ilike.%${search}%,content.ilike.%${search}%`);
    if (sort === "popular")   query = query.order("views", { ascending: false }).order("created_at", { ascending: false });
    else                      query = query.order("created_at", { ascending: false });

    if (tag) {
      const { data: tagRows } = await supabaseAdmin
        .from("post_tags")
        .select("post_id")
        .eq("tag", tag.toLowerCase())
        .limit(200);
      const tagIds = (tagRows ?? []).map((r) => r.post_id);
      if (tagIds.length === 0) return [];
      query = query.in("id", tagIds);
    }

    const { data, error } = await query;
    if (error) throw new HttpError(500, error.message);

    let result = await attachStats(data ?? []);

    if (sort === "trending") {
      result = result.sort((a, b) =>
        (b.likes + b.comments * 2 + b.shares) - (a.likes + a.comments * 2 + a.shares),
      );
    }

    return buildPublicPosts(result, userId);
  }

  // Newest — use cache if warm
  if (cache.isReady()) {
    const raw = cache.getCachedPosts({ page, pageSize, category, search });
    return buildPublicPosts(raw, userId);
  }

  let query = supabaseAdmin
    .from("posts")
    .select(FETCH_COLUMNS)
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1);

  if (category) query = query.eq("category", category);
  if (search)   query = query.or(`title.ilike.%${search}%,content.ilike.%${search}%`);

  const { data, error } = await query;
  if (error) throw new HttpError(500, error.message);

  const withStats = await attachStats(data ?? []);
  return buildPublicPosts(withStats, userId);
}

export async function getPost(id, userId) {
  const { data, error } = await supabaseAdmin
    .from("posts")
    .select(FETCH_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new HttpError(500, error.message);
  if (!data)  throw new HttpError(404, "Post not found");

  // Increment views (fire-and-forget)
  supabaseAdmin
    .from("posts")
    .update({ views: (data.views ?? 0) + 1 })
    .eq("id", id)
    .then(() => {})
    .catch(() => {});

  const cached = cache.getCachedStats(id);
  const withStats = cached
    ? { ...data, ...cached }
    : await (async () => {
        const [lk, cm, sh] = await Promise.all([
          supabaseAdmin.from("likes").select("id",    { count: "exact", head: true }).eq("post_id", id),
          supabaseAdmin.from("comments").select("id", { count: "exact", head: true }).eq("post_id", id),
          supabaseAdmin.from("shares").select("id",   { count: "exact", head: true }).eq("post_id", id),
        ]);
        return { ...data, likes: lk.count ?? 0, comments: cm.count ?? 0, shares: sh.count ?? 0 };
      })();

  const [result] = await buildPublicPosts([withStats], userId);
  return result;
}

export async function updateUserPost(postId, userId, { title, content, category }) {
  const { data: existing, error: selErr } = await supabaseAdmin
    .from("posts")
    .select("user_id, source")
    .eq("id", postId)
    .maybeSingle();
  if (selErr)    throw new HttpError(500, selErr.message);
  if (!existing) throw new HttpError(404, "Post not found");
  if (existing.source === "admin") throw new HttpError(403, "Admin posts cannot be edited here");
  if (existing.user_id !== userId) throw new HttpError(403, "You can only edit your own posts");

  const updates = {
    title:   title ? sanitizeText(title) : null,
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

  // Re-index hashtags
  await supabaseAdmin.from("post_tags").delete().eq("post_id", postId);
  const tags = extractHashtags(content);
  if (tags.length > 0) {
    await supabaseAdmin.from("post_tags").insert(tags.map((tag) => ({ post_id: postId, tag })));
  }

  cache.updatePost(postId, updates);
  const [result] = await buildPublicPosts([data], userId);
  return result;
}

export async function deleteUserPost(postId, userId) {
  const { data: existing, error: selErr } = await supabaseAdmin
    .from("posts")
    .select("user_id, source")
    .eq("id", postId)
    .maybeSingle();
  if (selErr)    throw new HttpError(500, selErr.message);
  if (!existing) throw new HttpError(404, "Post not found");
  if (existing.source === "admin") throw new HttpError(403, "Admin posts cannot be deleted here");
  if (existing.user_id !== userId) throw new HttpError(403, "You can only delete your own posts");

  const { error } = await supabaseAdmin.from("posts").delete().eq("id", postId);
  if (error) throw new HttpError(500, error.message);
  cache.removePost(postId);
  return { ok: true };
}

async function countRecentUserPosts(userId) {
  const since = new Date(Date.now() - DAY_MS).toISOString();
  const { count, error } = await supabaseAdmin
    .from("posts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", since);
  if (error) throw new HttpError(500, error.message);
  return count ?? 0;
}

export async function getRemainingPosts(userId) {
  const used = await countRecentUserPosts(userId);
  return Math.max(0, MAX_USER_POSTS_PER_DAY - used);
}

export async function createUserPost(userId, authorName, { title, content, category, image_url, event_date, poll_options }) {
  const recent = await countRecentUserPosts(userId);
  if (recent >= MAX_USER_POSTS_PER_DAY) {
    throw new HttpError(429, `You can only create ${MAX_USER_POSTS_PER_DAY} posts per day.`);
  }

  const { data, error } = await supabaseAdmin
    .from("posts")
    .insert({
      title:        title ? sanitizeText(title) : null,
      content:      sanitizeText(content),
      category,
      image_url:    image_url ?? null,
      user_id:      userId,
      source:       "user",
      author_name:  authorName || "Community Member",
      event_date:   event_date ?? null,
      poll_options: poll_options ? poll_options.map((o) => sanitizeText(o)) : null,
    })
    .select(FETCH_COLUMNS)
    .single();
  if (error) throw new HttpError(500, error.message);

  // Index hashtags
  const tags = extractHashtags(content);
  if (tags.length > 0) {
    supabaseAdmin.from("post_tags").insert(tags.map((tag) => ({ post_id: data.id, tag }))).then(() => {}).catch(() => {});
  }

  cache.addPost(data);
  const { user_id, ...rest } = data;
  return { ...rest, likes: 0, comments: 0, shares: 0, liked: false, bookmarked: false, is_mine: true };
}
