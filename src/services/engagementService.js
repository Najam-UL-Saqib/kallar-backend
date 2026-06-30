import { supabaseAdmin } from "../config/supabase.js";
import { HttpError } from "../middleware/errorHandler.js";
import { sanitizeText } from "../middleware/sanitize.js";
import * as cache from "../cache/postCache.js";
import { sendPushToUser } from "./pushService.js";

async function createNotification(type, targetUserId, actorName, postId, commentText = null) {
  if (!targetUserId) return;

  supabaseAdmin
    .from("notifications")
    .insert({ type, user_id: targetUserId, actor_name: actorName, post_id: postId, comment_text: commentText })
    .then(() => {})
    .catch(() => {});

  // Fire Web Push immediately — doesn't wait for DB insert to finish
  const actor = actorName || "Someone";
  const title = "Apna Kallar Syedan 🔔";
  const body  =
    type === "like"    ? `${actor} liked your post`
    : type === "comment" ? `${actor} commented: ${(commentText || "").slice(0, 60)}`
    : type === "reply"   ? `${actor} replied: ${(commentText || "").slice(0, 60)}`
    : `${actor} interacted with your post`;

  sendPushToUser(targetUserId, title, body).catch(() => {});
}

async function getPostOwner(postId) {
  const { data } = await supabaseAdmin.from("posts").select("user_id").eq("id", postId).maybeSingle();
  return data?.user_id ?? null;
}

async function getCommentOwner(commentId) {
  const { data } = await supabaseAdmin.from("comments").select("user_id").eq("id", commentId).maybeSingle();
  return data?.user_id ?? null;
}

export async function toggleLike(postId, userId, actorName) {
  const { data: existing, error: selErr } = await supabaseAdmin
    .from("likes")
    .select("id")
    .eq("post_id", postId)
    .eq("user_id", userId)
    .maybeSingle();
  if (selErr) throw new HttpError(500, selErr.message);

  if (existing) {
    const { error } = await supabaseAdmin.from("likes").delete().eq("post_id", postId).eq("user_id", userId);
    if (error) throw new HttpError(500, error.message);
    cache.updateLike(postId, -1);
    return { liked: false };
  }

  const { error } = await supabaseAdmin.from("likes").insert({ post_id: postId, user_id: userId });
  if (error && !/duplicate|unique/i.test(error.message)) throw new HttpError(500, error.message);
  cache.updateLike(postId, +1);

  // Notify post owner (but not yourself)
  const ownerUserId = await getPostOwner(postId);
  if (ownerUserId && ownerUserId !== userId) {
    createNotification("like", ownerUserId, actorName, postId);
  }

  return { liked: true };
}

export async function submitComment(postId, userId, authorName, { text, parent_id }) {
  const { data, error } = await supabaseAdmin
    .from("comments")
    .insert({
      post_id:      postId,
      user_id:      userId,
      comment_text: sanitizeText(text),
      author_name:  authorName ? sanitizeText(authorName.slice(0, 40)) : null,
      parent_id:    parent_id ?? null,
    })
    .select("id, comment_text, author_name, created_at, parent_id")
    .single();
  if (error) throw new HttpError(500, error.message);
  cache.updateComment(postId);

  if (parent_id) {
    // Notify parent comment owner
    const parentOwner = await getCommentOwner(parent_id);
    if (parentOwner && parentOwner !== userId) {
      createNotification("reply", parentOwner, authorName, postId, text.slice(0, 100));
    }
  } else {
    // Notify post owner
    const ownerUserId = await getPostOwner(postId);
    if (ownerUserId && ownerUserId !== userId) {
      createNotification("comment", ownerUserId, authorName, postId, text.slice(0, 100));
    }
  }

  return { ...data, is_mine: true };
}

export async function deleteComment(postId, commentId, userId) {
  const { data: existing, error: selErr } = await supabaseAdmin
    .from("comments")
    .select("user_id")
    .eq("id", commentId)
    .eq("post_id", postId)
    .maybeSingle();
  if (selErr)    throw new HttpError(500, selErr.message);
  if (!existing) throw new HttpError(404, "Comment not found");
  if (existing.user_id !== userId) throw new HttpError(403, "You can only delete your own comments");

  const { error } = await supabaseAdmin.from("comments").delete().eq("id", commentId);
  if (error) throw new HttpError(500, error.message);
  return { ok: true };
}

export async function toggleCommentLike(commentId, userId) {
  const { data: existing, error: selErr } = await supabaseAdmin
    .from("comment_likes")
    .select("id")
    .eq("comment_id", commentId)
    .eq("user_id", userId)
    .maybeSingle();
  if (selErr) throw new HttpError(500, selErr.message);

  if (existing) {
    await supabaseAdmin.from("comment_likes").delete().eq("comment_id", commentId).eq("user_id", userId);
  } else {
    const { error } = await supabaseAdmin.from("comment_likes").insert({ comment_id: commentId, user_id: userId });
    if (error && !/duplicate|unique/i.test(error.message)) throw new HttpError(500, error.message);
  }

  const { count } = await supabaseAdmin
    .from("comment_likes")
    .select("id", { count: "exact", head: true })
    .eq("comment_id", commentId);

  return { liked: !existing, likes: count ?? 0 };
}

export async function submitShare(postId, userId) {
  const { error } = await supabaseAdmin.from("shares").insert({ post_id: postId, user_id: userId });
  if (error && !/duplicate|unique/i.test(error.message)) throw new HttpError(500, error.message);
  cache.updateShare(postId);
  return { ok: true };
}

export async function getStats(postId, userId) {
  const cached = cache.getCachedStats(postId);
  const likedRow = userId
    ? await supabaseAdmin.from("likes").select("id").eq("post_id", postId).eq("user_id", userId).maybeSingle()
    : { data: null };

  if (cached) return { ...cached, liked: !!likedRow.data };

  const [likes, comments, shares] = await Promise.all([
    supabaseAdmin.from("likes").select("id",    { count: "exact", head: true }).eq("post_id", postId),
    supabaseAdmin.from("comments").select("id", { count: "exact", head: true }).eq("post_id", postId),
    supabaseAdmin.from("shares").select("id",   { count: "exact", head: true }).eq("post_id", postId),
  ]);
  return { likes: likes.count ?? 0, comments: comments.count ?? 0, shares: shares.count ?? 0, liked: !!likedRow.data };
}

export async function listComments(postId, userId) {
  const { data, error } = await supabaseAdmin
    .from("comments")
    .select("id, comment_text, user_id, author_name, created_at, parent_id")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });
  if (error) throw new HttpError(500, error.message);

  const commentIds = (data ?? []).map((c) => c.id);
  let likedCommentSet = new Set();
  let likeCounts = {};

  if (commentIds.length > 0) {
    const [likedRows, countRows] = await Promise.all([
      userId
        ? supabaseAdmin.from("comment_likes").select("comment_id").eq("user_id", userId).in("comment_id", commentIds)
        : { data: [] },
      supabaseAdmin.from("comment_likes").select("comment_id").in("comment_id", commentIds),
    ]);
    (likedRows.data ?? []).forEach((r) => likedCommentSet.add(r.comment_id));
    for (const r of (countRows.data ?? [])) {
      likeCounts[r.comment_id] = (likeCounts[r.comment_id] ?? 0) + 1;
    }
  }

  return (data ?? []).map(({ user_id, ...rest }) => ({
    ...rest,
    is_mine:      !!user_id && user_id === userId,
    liked_comment: likedCommentSet.has(rest.id),
    comment_likes: likeCounts[rest.id] ?? 0,
  }));
}

export async function toggleBookmark(postId, userId) {
  const { data: existing, error: selErr } = await supabaseAdmin
    .from("bookmarks")
    .select("id")
    .eq("post_id", postId)
    .eq("user_id", userId)
    .maybeSingle();
  if (selErr) throw new HttpError(500, selErr.message);

  if (existing) {
    await supabaseAdmin.from("bookmarks").delete().eq("post_id", postId).eq("user_id", userId);
    return { bookmarked: false };
  }

  const { error } = await supabaseAdmin.from("bookmarks").insert({ post_id: postId, user_id: userId });
  if (error && !/duplicate|unique/i.test(error.message)) throw new HttpError(500, error.message);
  return { bookmarked: true };
}

export async function listBookmarks(userId) {
  const { data, error } = await supabaseAdmin
    .from("bookmarks")
    .select("post_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new HttpError(500, error.message);

  const postIds = (data ?? []).map((b) => b.post_id);
  if (postIds.length === 0) return [];

  const { data: posts, error: postErr } = await supabaseAdmin
    .from("posts")
    .select("id, author_name, title, content, image_url, category, source, created_at, user_id, views, pinned, event_date, poll_options")
    .in("id", postIds);
  if (postErr) throw new HttpError(500, postErr.message);

  const [likeData, commentData, shareData] = await Promise.all([
    supabaseAdmin.from("likes").select("post_id").in("post_id", postIds),
    supabaseAdmin.from("comments").select("post_id").in("post_id", postIds),
    supabaseAdmin.from("shares").select("post_id").in("post_id", postIds),
  ]);

  const lc = {};
  const cc = {};
  const sc = {};
  for (const r of (likeData.data ?? []))    lc[r.post_id] = (lc[r.post_id] ?? 0) + 1;
  for (const r of (commentData.data ?? []))  cc[r.post_id] = (cc[r.post_id] ?? 0) + 1;
  for (const r of (shareData.data ?? []))    sc[r.post_id] = (sc[r.post_id] ?? 0) + 1;

  const { data: likedData } = await supabaseAdmin
    .from("likes")
    .select("post_id")
    .eq("user_id", userId)
    .in("post_id", postIds);
  const likedSet = new Set((likedData ?? []).map((r) => r.post_id));

  return (posts ?? []).map(({ user_id, ...rest }) => ({
    ...rest,
    likes:      lc[rest.id]   ?? 0,
    comments:   cc[rest.id]   ?? 0,
    shares:     sc[rest.id]   ?? 0,
    liked:      likedSet.has(rest.id),
    bookmarked: true,
    is_mine:    !!user_id && user_id === userId,
  }));
}

export async function votePoll(postId, userId, optionIndex) {
  // Check post has poll_options
  const { data: post, error: postErr } = await supabaseAdmin
    .from("posts")
    .select("poll_options")
    .eq("id", postId)
    .maybeSingle();
  if (postErr)  throw new HttpError(500, postErr.message);
  if (!post)    throw new HttpError(404, "Post not found");
  if (!post.poll_options) throw new HttpError(400, "This post is not a poll");
  if (optionIndex < 0 || optionIndex >= post.poll_options.length)
    throw new HttpError(400, "Invalid option");

  const { data: existing } = await supabaseAdmin
    .from("poll_votes")
    .select("id, option_index")
    .eq("post_id", postId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) {
    if (existing.option_index === optionIndex) {
      // Un-vote
      await supabaseAdmin.from("poll_votes").delete().eq("id", existing.id);
    } else {
      // Change vote
      await supabaseAdmin.from("poll_votes").update({ option_index: optionIndex }).eq("id", existing.id);
    }
  } else {
    const { error } = await supabaseAdmin.from("poll_votes").insert({ post_id: postId, user_id: userId, option_index: optionIndex });
    if (error && !/duplicate|unique/i.test(error.message)) throw new HttpError(500, error.message);
  }

  return getPollResults(postId, userId);
}

export async function getPollResults(postId, userId) {
  const [votesData, myVoteData] = await Promise.all([
    supabaseAdmin.from("poll_votes").select("option_index").eq("post_id", postId),
    userId
      ? supabaseAdmin.from("poll_votes").select("option_index").eq("post_id", postId).eq("user_id", userId).maybeSingle()
      : { data: null },
  ]);

  const counts = {};
  for (const r of (votesData.data ?? [])) {
    counts[r.option_index] = (counts[r.option_index] ?? 0) + 1;
  }
  return {
    votes:      counts,
    total:      votesData.data?.length ?? 0,
    voted_option: myVoteData.data?.option_index ?? null,
  };
}
