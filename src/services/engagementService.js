import { supabaseAdmin } from "../config/supabase.js";
import { HttpError } from "../middleware/errorHandler.js";
import { sanitizeText } from "../middleware/sanitize.js";
import * as cache from "../cache/postCache.js";

export async function toggleLike(postId, deviceId) {
  const { data: existing, error: selErr } = await supabaseAdmin
    .from("likes")
    .select("id")
    .eq("post_id", postId)
    .eq("device_id", deviceId)
    .maybeSingle();
  if (selErr) throw new HttpError(500, selErr.message);

  if (existing) {
    const { error } = await supabaseAdmin
      .from("likes")
      .delete()
      .eq("post_id", postId)
      .eq("device_id", deviceId);
    if (error) throw new HttpError(500, error.message);
    cache.updateLike(postId, -1);
    return { liked: false };
  }

  const { error } = await supabaseAdmin
    .from("likes")
    .insert({ post_id: postId, device_id: deviceId });
  if (error && !/duplicate|unique/i.test(error.message)) throw new HttpError(500, error.message);
  cache.updateLike(postId, +1);
  return { liked: true };
}

export async function submitComment(postId, deviceId, { text, authorName }) {
  const { data, error } = await supabaseAdmin
    .from("comments")
    .insert({
      post_id: postId,
      device_id: deviceId,
      comment_text: sanitizeText(text),
      author_name: authorName ? sanitizeText(authorName) : null,
    })
    .select("id, comment_text, author_name, created_at")
    .single();
  if (error) throw new HttpError(500, error.message);
  cache.updateComment(postId);
  return { ...data, is_mine: true }; // commenter always owns their own comment
}

export async function submitShare(postId, deviceId) {
  const { error } = await supabaseAdmin
    .from("shares")
    .insert({ post_id: postId, device_id: deviceId });
  if (error && !/duplicate|unique/i.test(error.message)) throw new HttpError(500, error.message);
  cache.updateShare(postId);
  return { ok: true };
}

export async function getStats(postId, deviceId) {
  const cached = cache.getCachedStats(postId);

  // `liked` is always device-specific — must come from DB (1 query regardless)
  const { data: likedRow, error: likedErr } = await supabaseAdmin
    .from("likes")
    .select("id")
    .eq("post_id", postId)
    .eq("device_id", deviceId)
    .maybeSingle();
  if (likedErr) throw new HttpError(500, likedErr.message);

  if (cached) {
    // Cache hit: 1 DB query total (vs the previous 4)
    return {
      likes:    cached.likes,
      comments: cached.comments,
      shares:   cached.shares,
      liked:    !!likedRow,
    };
  }

  // Cache miss (cold start) — full DB fetch
  const [likes, comments, shares] = await Promise.all([
    supabaseAdmin.from("likes").select("id", { count: "exact", head: true }).eq("post_id", postId),
    supabaseAdmin.from("comments").select("id", { count: "exact", head: true }).eq("post_id", postId),
    supabaseAdmin.from("shares").select("id", { count: "exact", head: true }).eq("post_id", postId),
  ]);
  if (likes.error) throw new HttpError(500, likes.error.message);
  if (comments.error) throw new HttpError(500, comments.error.message);
  if (shares.error) throw new HttpError(500, shares.error.message);
  return {
    likes:    likes.count    ?? 0,
    comments: comments.count ?? 0,
    shares:   shares.count   ?? 0,
    liked:    !!likedRow,
  };
}

export async function listComments(postId, deviceId) {
  const { data, error } = await supabaseAdmin
    .from("comments")
    .select("id, comment_text, device_id, author_name, created_at")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });
  if (error) throw new HttpError(500, error.message);
  // Strip device_id — replace with is_mine so the client knows which comments are theirs
  return (data ?? []).map(({ device_id, ...rest }) => ({
    ...rest,
    is_mine: !!device_id && device_id === deviceId,
  }));
}
