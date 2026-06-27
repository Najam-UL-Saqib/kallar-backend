import { supabaseAdmin } from "../config/supabase.js";
import { HttpError } from "../middleware/errorHandler.js";
import { sanitizeText } from "../middleware/sanitize.js";

export async function createReport(postId, userId, reason) {
  // Confirm the post exists so reports can't be spammed against arbitrary ids.
  const { data: post, error: postErr } = await supabaseAdmin
    .from("posts")
    .select("id")
    .eq("id", postId)
    .maybeSingle();
  if (postErr) throw new HttpError(500, postErr.message);
  if (!post) throw new HttpError(404, "Post not found");

  const { data, error } = await supabaseAdmin
    .from("reports")
    .insert({ post_id: postId, user_id: userId, reason: sanitizeText(reason) || null })
    .select("id, post_id, reason, created_at")
    .single();
  if (error) throw new HttpError(500, error.message);
  return data;
}

export async function listReports() {
  const { data, error } = await supabaseAdmin
    .from("reports")
    .select("id, post_id, reason, created_at, posts(id, title, content, category)")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw new HttpError(500, error.message);
  return data;
}

export async function deleteReport(id) {
  const { error } = await supabaseAdmin.from("reports").delete().eq("id", id);
  if (error) throw new HttpError(500, error.message);
  return { ok: true };
}
