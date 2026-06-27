import { supabaseAdmin } from "../config/supabase.js";
import { HttpError } from "../middleware/errorHandler.js";
import { sanitizeText } from "../middleware/sanitize.js";

const COLS = "id, email, name, avatar_url, bio, created_at";

// Create or update profile on every Google login
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
    .select("id, author_name, title, content, image_url, category, source, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1);
  if (error) throw new HttpError(500, error.message);
  return (data ?? []).map((p) => ({ ...p, is_mine: true, liked: false, likes: 0, comments: 0, shares: 0 }));
}
