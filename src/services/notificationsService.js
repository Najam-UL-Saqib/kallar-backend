import { supabaseAdmin } from "../config/supabase.js";
import { HttpError } from "../middleware/errorHandler.js";

export async function listNotifications(userId) {
  const { data, error } = await supabaseAdmin
    .from("notifications")
    .select("id, type, actor_name, post_id, comment_text, read, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new HttpError(500, error.message);
  return data ?? [];
}

export async function markAllRead(userId) {
  const { error } = await supabaseAdmin
    .from("notifications")
    .update({ read: true })
    .eq("user_id", userId)
    .eq("read", false);
  if (error) throw new HttpError(500, error.message);
  return { ok: true };
}

export async function unreadCount(userId) {
  const { count, error } = await supabaseAdmin
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("read", false);
  if (error) throw new HttpError(500, error.message);
  return count ?? 0;
}
