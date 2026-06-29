import { supabaseAdmin } from "../config/supabase.js";
import { HttpError } from "../middleware/errorHandler.js";
import { sanitizeText } from "../middleware/sanitize.js";

const COLS = "id, email, name, avatar_url, bio, created_at";

export async function upsertProfile({ id, email, name, avatar_url }) {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .upsert(
      { id, email, name, avatar_url, updated_at: new Date().toISOString() },
      { onConflict: "id", ignoreDuplicates: false },
    )
    .select(COLS)
    .single();
  if (error) throw new HttpError(500, error.message);
  return data;
}

export async function getProfile(userId) {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select(COLS)
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new HttpError(500, error.message);
  if (!data) throw new HttpError(404, "Profile not found");
  return data;
}

export async function getPublicProfile(userId) {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, name, avatar_url, bio, created_at")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new HttpError(500, error.message);
  if (!data) throw new HttpError(404, "User not found");

  const { count } = await supabaseAdmin
    .from("posts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  return { ...data, post_count: count ?? 0 };
}

export async function getPublicUserPosts(userId, { page = 0, pageSize = 10 } = {}) {
  const from = page * pageSize;
  const { data, error } = await supabaseAdmin
    .from("posts")
    .select("id, author_name, title, content, image_url, category, source, created_at, views, pinned, event_date, poll_options")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1);
  if (error) throw new HttpError(500, error.message);
  return (data ?? []).map((p) => ({ ...p, is_mine: false, liked: false, bookmarked: false, likes: 0, comments: 0, shares: 0 }));
}

export async function updateProfile(userId, { name, bio }) {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .update({
      name:       name != null ? sanitizeText(name.slice(0, 80)) : null,
      bio:        bio  != null ? sanitizeText(bio.slice(0, 300)) : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId)
    .select(COLS)
    .single();
  if (error) throw new HttpError(500, error.message);
  return data;
}

export async function getUserPosts(userId, { page = 0, pageSize = 10 } = {}) {
  const from = page * pageSize;
  const { data, error } = await supabaseAdmin
    .from("posts")
    .select("id, author_name, title, content, image_url, category, source, created_at, views, pinned, event_date, poll_options")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1);
  if (error) throw new HttpError(500, error.message);
  return (data ?? []).map((p) => ({ ...p, is_mine: true, liked: false, bookmarked: false, likes: 0, comments: 0, shares: 0 }));
}
