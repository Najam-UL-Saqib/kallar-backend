import { scryptSync, timingSafeEqual } from "node:crypto";
import { supabaseAdmin } from "../config/supabase.js";
import { env } from "../config/env.js";
import { HttpError } from "../middleware/errorHandler.js";
import { sanitizeText } from "../middleware/sanitize.js";
import * as cache from "../cache/postCache.js";

export function checkAdminPassword(password) {
  const stored = env.adminPasswordHash;
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) throw new HttpError(500, "ADMIN_PASSWORD_HASH is malformed");
  const a = scryptSync(password, salt, 64);
  const b = Buffer.from(hash, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

const ADMIN_POST_COLUMNS = "*";
const ALLOWED_TABLES = new Set(["likes", "comments", "shares"]);

export async function adminListPosts() {
  const { data, error } = await supabaseAdmin
    .from("posts")
    .select(ADMIN_POST_COLUMNS)
    .order("created_at", { ascending: false });
  if (error) throw new HttpError(500, error.message);
  return data;
}

export async function adminCreatePost({ title, content, category, image_url, author_name }) {
  const { data, error } = await supabaseAdmin
    .from("posts")
    .insert({
      title: title ? sanitizeText(title) : null,
      content: sanitizeText(content),
      category,
      image_url: image_url ?? null,
      author_name: sanitizeText(author_name),
      source: "admin",
    })
    .select()
    .single();
  if (error) throw new HttpError(500, error.message);
  cache.addPost(data);
  return data;
}

export async function adminUpdatePost(id, { title, content, category, image_url, author_name }) {
  const updates = {
    title: title ? sanitizeText(title) : null,
    content: sanitizeText(content),
    category,
    image_url: image_url ?? null,
    author_name: sanitizeText(author_name),
  };
  const { error } = await supabaseAdmin.from("posts").update(updates).eq("id", id);
  if (error) throw new HttpError(500, error.message);
  cache.updatePost(id, updates);
  return { ok: true };
}

export async function adminDeletePost(id) {
  // likes/comments/shares/reports cascade via FK ON DELETE CASCADE.
  const { error } = await supabaseAdmin.from("posts").delete().eq("id", id);
  if (error) throw new HttpError(500, error.message);
  cache.removePost(id);
  return { ok: true };
}

export async function adminListTable(table) {
  if (!ALLOWED_TABLES.has(table)) throw new HttpError(400, "Invalid table");
  const { data, error } = await supabaseAdmin
    .from(table)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw new HttpError(500, error.message);
  return data;
}

export async function adminDeleteRow(table, id) {
  if (!ALLOWED_TABLES.has(table)) throw new HttpError(400, "Invalid table");
  const { error } = await supabaseAdmin.from(table).delete().eq("id", id);
  if (error) throw new HttpError(500, error.message);
  return { ok: true };
}

export async function adminStats() {
  const [posts, likes, comments, shares, reports] = await Promise.all([
    supabaseAdmin.from("posts").select("*", { count: "exact", head: true }),
    supabaseAdmin.from("likes").select("*", { count: "exact", head: true }),
    supabaseAdmin.from("comments").select("*", { count: "exact", head: true }),
    supabaseAdmin.from("shares").select("*", { count: "exact", head: true }),
    supabaseAdmin.from("reports").select("*", { count: "exact", head: true }),
  ]);
  return {
    posts: posts.count ?? 0,
    likes: likes.count ?? 0,
    comments: comments.count ?? 0,
    shares: shares.count ?? 0,
    reports: reports.count ?? 0,
  };
}
