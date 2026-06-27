import { supabaseAdmin } from "../config/supabase.js";
import { HttpError } from "../middleware/errorHandler.js";
import { sanitizeText } from "../middleware/sanitize.js";
import * as cache from "../cache/postCache.js";

export async function toggleLike(postId, userId) {
  const { data: existing, error: selErr } = await supabaseAdmin
    .from("likes")
    .select("id")
    .eq("post_id", postId)
    .eq("user_id", userId)
    .maybeSingle();
  if (selErr) throw new HttpError(500, selErr.message);

  if (existing) {
    const { error } = await supabaseAdmin
      .from("likes")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", userId);
    if (error) throw new HttpError(500, error.message);
    cache.updateLike(postId, -1);
    return { liked: false };
  }

  const { error } = await supabaseAdmin
    .from("likes")
    .insert({ post_id: postId, user_id: userId });
  if (error && !/duplicate|unique/i.test(error.message)) throw new HttpError(500, error.message);
  cache.updateLike(postId, +1);
  return { liked: true };
}

export async function submitComment(postId, userId, authorName, { text }) {
  const { data, error } = await supabaseAdmin
    .from("comments")
    .insert({
      post_id:      postId,
      user_id:      userId,
      comment_text: sanitizeText(text),
      author_name:  authorName ? sanitizeText(authorName.slice(0, 40)) : null,
    })
    .select("id, comment_text, author_name, created_at")
    .single();
  if (error) throw new HttpError(500, error.message);
  cache.updateComment(postId);
  return { ...data, is_mine: true };
}

export async function submitShare(postId, userId) {
  const { error } = await supabaseAdmin
    .from("shares")
    .insert({ post_id: postId, user_id: userId });
  if (error && !/duplicate|unique/i.test(error.message)) throw new HttpError(500, error.message);
  cache.updateShare(postId);
  return { ok: true };
}

export async function getStats(postId, userId) {
  const cached = cache.getCachedStats(postId);
  const likedRow = userId
    ? await supabaseAdmin.from("likes").select("id").eq("post_id", postId).eq("user_id", userId).maybeSingle()
    : { data: null };

  if (cached) {
    return { ...cached, liked: !!likedRow.data };
  }

  const [likes, comments, shares] = await Promise.all([
    supabaseAdmin.from("likes").select("id",    { count: "exact", head: true }).eq("post_id", postId),
    supabaseAdmin.from("comments").select("id", { count: "exact", head: true }).eq("post_id", postId),
    supabaseAdmin.from("shares").select("id",   { count: "exact", head: true }).eq("post_id", postId),
  ]);
  return {
    likes:    likes.count    ?? 0,
    comments: comments.count ?? 0,
    shares:   shares.count   ?? 0,
    liked:    !!likedRow.data,
  };
}

export async function listComments(postId, userId) {
  const { data, error } = await supabaseAdmin
    .from("comments")
    .select("id, comment_text, user_id, author_name, created_at")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });
  if (error) throw new HttpError(500, error.message);
  return (data ?? []).map(({ user_id, ...rest }) => ({
    ...rest,
    is_mine: !!user_id && user_id === userId,
  }));
}
