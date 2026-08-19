import { supabaseAdmin } from "../config/supabase.js";
import { HttpError } from "../middleware/errorHandler.js";
import { sanitizeText } from "../middleware/sanitize.js";
import { MAX_USER_LISTINGS_PER_DAY } from "../utils/validators.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_IMAGES = 3;
const COLUMNS =
  "id, user_id, title, description, price, category, condition, image_urls, location, contact_phone, contact_whatsapp, status, created_at, updated_at";

function toPublic({ user_id, ...rest }, viewerId) {
  return { ...rest, is_mine: !!user_id && user_id === viewerId };
}

export async function listListings({ page = 0, pageSize = 12, category, search, mine, userId }) {
  let query = supabaseAdmin.from("marketplace_listings").select(COLUMNS);

  if (mine) {
    if (!userId) throw new HttpError(401, "Login required");
    query = query.eq("user_id", userId);
  } else {
    query = query.eq("status", "active");
  }
  if (category && category !== "All") query = query.eq("category", category);
  if (search) query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);

  query = query
    .order("created_at", { ascending: false })
    .range(page * pageSize, page * pageSize + pageSize - 1);

  const { data, error } = await query;
  if (error) throw new HttpError(500, error.message);
  return (data ?? []).map((l) => toPublic(l, userId));
}

export async function getListing(id, userId) {
  const { data, error } = await supabaseAdmin.from("marketplace_listings").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new HttpError(500, error.message);
  if (!data) throw new HttpError(404, "Listing not found");
  return toPublic(data, userId);
}

async function countRecentUserListings(userId) {
  const since = new Date(Date.now() - DAY_MS).toISOString();
  const { count, error } = await supabaseAdmin
    .from("marketplace_listings")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", since);
  if (error) throw new HttpError(500, error.message);
  return count ?? 0;
}

export async function getRemainingListings(userId) {
  const used = await countRecentUserListings(userId);
  return Math.max(0, MAX_USER_LISTINGS_PER_DAY - used);
}

export async function createListing(userId, data, image_urls) {
  const recent = await countRecentUserListings(userId);
  if (recent >= MAX_USER_LISTINGS_PER_DAY) {
    throw new HttpError(429, `You can only post ${MAX_USER_LISTINGS_PER_DAY} listings per day.`);
  }

  const { data: row, error } = await supabaseAdmin
    .from("marketplace_listings")
    .insert({
      user_id:          userId,
      title:            sanitizeText(data.title),
      description:      sanitizeText(data.description),
      price:            data.price ?? null,
      category:         data.category,
      condition:        data.condition,
      image_urls:       (image_urls ?? []).slice(0, MAX_IMAGES),
      location:         data.location ? sanitizeText(data.location) : null,
      contact_phone:    data.contact_phone ? sanitizeText(data.contact_phone) : null,
      contact_whatsapp: data.contact_whatsapp ? sanitizeText(data.contact_whatsapp) : null,
    })
    .select(COLUMNS)
    .single();
  if (error) throw new HttpError(500, error.message);
  return toPublic(row, userId);
}

// existingUrls: URLs the client says it wants to keep — validated against
// what the listing actually already has, so a caller can't inject arbitrary
// image URLs onto someone else's listing. newUrls: freshly uploaded this
// request (already trusted, they went through our own Cloudinary upload).
export async function updateListing(id, userId, data, existingUrls, newUrls) {
  const { data: existing, error: selErr } = await supabaseAdmin
    .from("marketplace_listings").select("user_id, image_urls").eq("id", id).maybeSingle();
  if (selErr)    throw new HttpError(500, selErr.message);
  if (!existing) throw new HttpError(404, "Listing not found");
  if (existing.user_id !== userId) throw new HttpError(403, "You can only edit your own listings");

  const currentUrls = existing.image_urls ?? [];
  const keptUrls = (existingUrls ?? []).filter((u) => currentUrls.includes(u));
  const image_urls = [...keptUrls, ...(newUrls ?? [])].slice(0, MAX_IMAGES);

  const { data: row, error } = await supabaseAdmin
    .from("marketplace_listings")
    .update({
      title:            sanitizeText(data.title),
      description:      sanitizeText(data.description),
      price:            data.price ?? null,
      category:         data.category,
      condition:        data.condition,
      image_urls,
      location:         data.location ? sanitizeText(data.location) : null,
      contact_phone:    data.contact_phone ? sanitizeText(data.contact_phone) : null,
      contact_whatsapp: data.contact_whatsapp ? sanitizeText(data.contact_whatsapp) : null,
      updated_at:       new Date().toISOString(),
    })
    .eq("id", id)
    .select(COLUMNS)
    .single();
  if (error) throw new HttpError(500, error.message);
  return toPublic(row, userId);
}

export async function updateListingStatus(id, userId, status) {
  const { data: existing, error: selErr } = await supabaseAdmin
    .from("marketplace_listings").select("user_id").eq("id", id).maybeSingle();
  if (selErr)    throw new HttpError(500, selErr.message);
  if (!existing) throw new HttpError(404, "Listing not found");
  if (existing.user_id !== userId) throw new HttpError(403, "You can only update your own listings");

  const { data, error } = await supabaseAdmin
    .from("marketplace_listings")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(COLUMNS)
    .single();
  if (error) throw new HttpError(500, error.message);
  return toPublic(data, userId);
}

export async function deleteListing(id, userId) {
  const { data: existing, error: selErr } = await supabaseAdmin
    .from("marketplace_listings").select("user_id").eq("id", id).maybeSingle();
  if (selErr)    throw new HttpError(500, selErr.message);
  if (!existing) throw new HttpError(404, "Listing not found");
  if (existing.user_id !== userId) throw new HttpError(403, "You can only delete your own listings");

  const { error } = await supabaseAdmin.from("marketplace_listings").delete().eq("id", id);
  if (error) throw new HttpError(500, error.message);
  return { ok: true };
}

export async function reportListing(listingId, userId, reason) {
  const { data: listing, error: selErr } = await supabaseAdmin
    .from("marketplace_listings").select("id").eq("id", listingId).maybeSingle();
  if (selErr)    throw new HttpError(500, selErr.message);
  if (!listing)  throw new HttpError(404, "Listing not found");

  const { data, error } = await supabaseAdmin
    .from("marketplace_reports")
    .insert({ listing_id: listingId, user_id: userId, reason: sanitizeText(reason) || null })
    .select("id")
    .single();
  if (error) throw new HttpError(500, error.message);
  return data;
}
