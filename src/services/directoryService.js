import { supabaseAdmin } from "../config/supabase.js";
import { HttpError } from "../middleware/errorHandler.js";
import { sanitizeText } from "../middleware/sanitize.js";

export async function listDirectory() {
  const { data, error } = await supabaseAdmin
    .from("directory")
    .select("id, name, category, phone, whatsapp, description, created_at")
    .order("category")
    .order("name");
  if (error) throw new HttpError(500, error.message);
  return data ?? [];
}

export async function createEntry({ name, category, phone, whatsapp, description }) {
  const { data, error } = await supabaseAdmin
    .from("directory")
    .insert({
      name:        sanitizeText(name),
      category:    sanitizeText(category),
      phone:       phone       ? sanitizeText(phone)       : null,
      whatsapp:    whatsapp    ? sanitizeText(whatsapp)    : null,
      description: description ? sanitizeText(description) : null,
    })
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
