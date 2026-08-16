import { supabaseAdmin } from "../config/supabase.js";
import { HttpError } from "../middleware/errorHandler.js";
import { sanitizeText } from "../middleware/sanitize.js";

const PUBLIC_COLS = "id, name, category, phone, whatsapp, description, created_at";
const ADMIN_COLS = "id, name, category, phone, whatsapp, description, status, submitted_by, created_at";

// Public listing — only entries an admin has approved. Keeps unreviewed
// (or rejected) submissions invisible until someone checks them.
export async function listDirectory() {
  const { data, error } = await supabaseAdmin
    .from("directory")
    .select(PUBLIC_COLS)
    .eq("status", "approved")
    .order("category")
    .order("name");
  if (error) throw new HttpError(500, error.message);
  return data ?? [];
}

// Admin listing — every entry regardless of status, so pending submissions
// can be reviewed and approved/rejected.
export async function listDirectoryAdmin() {
  const { data, error } = await supabaseAdmin
    .from("directory")
    .select(ADMIN_COLS)
    .order("status")
    .order("category")
    .order("name");
  if (error) throw new HttpError(500, error.message);
  return data ?? [];
}

// Admin-created entries go live immediately — the admin adding it *is* the review.
export async function createEntry({ name, category, phone, whatsapp, description }) {
  const { data, error } = await supabaseAdmin
    .from("directory")
    .insert({
      name:        sanitizeText(name),
      category:    sanitizeText(category),
      phone:       phone       ? sanitizeText(phone)       : null,
      whatsapp:    whatsapp    ? sanitizeText(whatsapp)    : null,
      description: description ? sanitizeText(description) : null,
      status: "approved",
    })
    .select()
    .single();
  if (error) throw new HttpError(500, error.message);
  return data;
}

// A regular user suggesting a listing — held as "pending" until an admin
// approves it, so nobody can quietly post a number that isn't theirs to share.
export async function submitEntry(userId, { name, category, phone, whatsapp, description }) {
  const { data, error } = await supabaseAdmin
    .from("directory")
    .insert({
      name:        sanitizeText(name),
      category:    sanitizeText(category),
      phone:       phone       ? sanitizeText(phone)       : null,
      whatsapp:    whatsapp    ? sanitizeText(whatsapp)    : null,
      description: description ? sanitizeText(description) : null,
      status: "pending",
      submitted_by: userId,
    })
    .select()
    .single();
  if (error) throw new HttpError(500, error.message);
  return data;
}

export async function approveEntry(id) {
  const { data, error } = await supabaseAdmin
    .from("directory")
    .update({ status: "approved" })
    .eq("id", id)
    .select()
    .single();
  if (error) throw new HttpError(500, error.message);
  return data;
}

export async function updateEntry(id, { name, category, phone, whatsapp, description }) {
  const { data, error } = await supabaseAdmin
    .from("directory")
    .update({
      name:        sanitizeText(name),
      category:    sanitizeText(category),
      phone:       phone       ? sanitizeText(phone)       : null,
      whatsapp:    whatsapp    ? sanitizeText(whatsapp)    : null,
      description: description ? sanitizeText(description) : null,
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw new HttpError(500, error.message);
  return data;
}

export async function deleteEntry(id) {
  const { error } = await supabaseAdmin.from("directory").delete().eq("id", id);
  if (error) throw new HttpError(500, error.message);
  return { ok: true };
}
