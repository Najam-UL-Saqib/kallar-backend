import { supabaseAdmin } from "../config/supabase.js";
import { HttpError } from "../middleware/errorHandler.js";
import { sanitizeText } from "../middleware/sanitize.js";

const PUBLIC_COLS = "id, name, category, phone, whatsapp, description, created_at";
const ADMIN_COLS = "id, name, category, phone, whatsapp, description, status, submitted_by, created_at";

// Reduces a Pakistani phone number to a bare local-format string so
// "+923001234567", "923001234567" and "03001234567" all compare equal —
// otherwise the same number typed slightly differently would sail past a
// naive string-equality duplicate check.
function normalizePhone(raw) {
  if (!raw) return null;
  let digits = String(raw).replace(/\D/g, "");
  if (digits.startsWith("0092")) digits = digits.slice(4);
  else if (digits.startsWith("92")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = digits.slice(1);
  return digits || null;
}

// Blocks a phone/WhatsApp number that's already attached to a different
// business — same guardrail as requiring a contact number in the first
// place: it keeps the directory from filling up with duplicate or
// impersonated listings. Checks against both fields on existing entries,
// since a number could be listed as "phone" on one entry and "whatsapp"
// on another. Rejected entries don't count — a rejected submission
// shouldn't permanently block that number from being listed correctly.
async function assertContactNotTaken({ phone, whatsapp }, excludeId = null) {
  const normPhone = normalizePhone(phone);
  const normWhatsapp = normalizePhone(whatsapp);
  if (!normPhone && !normWhatsapp) return;

  let query = supabaseAdmin.from("directory").select("id, name, phone, whatsapp").neq("status", "rejected");
  if (excludeId) query = query.neq("id", excludeId);
  const { data, error } = await query;
  if (error) throw new HttpError(500, error.message);

  for (const row of data ?? []) {
    const rowPhone = normalizePhone(row.phone);
    const rowWhatsapp = normalizePhone(row.whatsapp);
    const matches = (n) => !!n && (n === rowPhone || n === rowWhatsapp);
    if (matches(normPhone) || matches(normWhatsapp)) {
      throw new HttpError(409, `That number is already listed for "${row.name}"`);
    }
  }
}

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
  await assertContactNotTaken({ phone, whatsapp });
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
  await assertContactNotTaken({ phone, whatsapp });
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
  await assertContactNotTaken({ phone, whatsapp }, id);
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
