import { asyncHandler } from "../utils/asyncHandler.js";
import { HttpError } from "../middleware/errorHandler.js";
import { marketplaceListingSchema, reportSchema, MAX_RAW_IMAGE_BYTES } from "../utils/validators.js";
import { enforceRateLimit } from "../middleware/rateLimiter.js";
import {
  listListings, getListing, createListing, updateListing, updateListingStatus,
  deleteListing, getRemainingListings, reportListing,
} from "../services/marketplaceService.js";
import { uploadImageBuffer } from "../services/cloudinaryService.js";

const MAX_IMAGES = 3;

function parseListingFields(req) {
  const parsed = marketplaceListingSchema.safeParse({
    title: req.body.title,
    description: req.body.description,
    price: req.body.price ? req.body.price : null,
    category: req.body.category || undefined,
    condition: req.body.condition || undefined,
    location: req.body.location || null,
    contact_phone: req.body.contact_phone || null,
    contact_whatsapp: req.body.contact_whatsapp || null,
  });
  if (!parsed.success)
    throw new HttpError(400, parsed.error.issues[0]?.message || "Invalid listing data");
  if (!parsed.data.contact_phone && !parsed.data.contact_whatsapp)
    throw new HttpError(400, "Add a phone number or WhatsApp number so buyers can reach you");
  return parsed.data;
}

async function uploadListingImages(files) {
  if (!files || files.length === 0) return [];
  if (files.length > MAX_IMAGES) throw new HttpError(400, `Up to ${MAX_IMAGES} photos allowed`);
  if (files.some((f) => f.size > MAX_RAW_IMAGE_BYTES))
    throw new HttpError(400, "Each image must be 3 MB or smaller. Please compress it at squoosh.app");

  const urls = [];
  for (const file of files) {
    const uploaded = await uploadImageBuffer(file.buffer, "marketplace-images");
    urls.push(uploaded.url);
  }
  return urls;
}

export const getListings = asyncHandler(async (req, res) => {
  const page = Number(req.query.page) || 0;
  const pageSize = Math.min(Number(req.query.pageSize) || 12, 30);
  const category = req.query.category || undefined;
  const search = req.query.search ? String(req.query.search).slice(0, 100) : undefined;
  const mine = req.query.mine === "true";
  res.json(await listListings({ page, pageSize, category, search, mine, userId: req.userId }));
});

export const getListingById = asyncHandler(async (req, res) => {
  res.json(await getListing(req.params.id, req.userId));
});

export const remainingListings = asyncHandler(async (req, res) => {
  res.json({ remaining: await getRemainingListings(req.userId) });
});

export const createListingHandler = asyncHandler(async (req, res) => {
  const data = parseListingFields(req);
  await enforceRateLimit(req.userId, "listing");
  const image_urls = await uploadListingImages(req.files);
  res.status(201).json(await createListing(req.userId, data, image_urls));
});

export const updateListingHandler = asyncHandler(async (req, res) => {
  const data = parseListingFields(req);
  const newUrls = await uploadListingImages(req.files);

  let existingUrls = [];
  if (req.body.existing_image_urls) {
    try { existingUrls = JSON.parse(req.body.existing_image_urls); } catch { existingUrls = []; }
  }

  res.json(await updateListing(req.params.id, req.userId, data, existingUrls, newUrls));
});

export const updateStatus = asyncHandler(async (req, res) => {
  const status = req.body.status;
  if (!["active", "sold"].includes(status)) throw new HttpError(400, "Invalid status");
  res.json(await updateListingStatus(req.params.id, req.userId, status));
});

export const removeListing = asyncHandler(async (req, res) => {
  res.json(await deleteListing(req.params.id, req.userId));
});

export const reportListingHandler = asyncHandler(async (req, res) => {
  const parsed = reportSchema.safeParse({ reason: req.body.reason });
  if (!parsed.success) throw new HttpError(400, "Invalid report");
  await enforceRateLimit(req.userId, "report");
  res.status(201).json(await reportListing(req.params.id, req.userId, parsed.data.reason));
});
