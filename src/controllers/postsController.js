import { asyncHandler } from "../utils/asyncHandler.js";
import { postCreateSchema, postUpdateSchema, MAX_IMAGE_BYTES } from "../utils/validators.js";
import { HttpError } from "../middleware/errorHandler.js";
import { enforceRateLimit } from "../middleware/rateLimiter.js";
import { listPosts, getPost, createUserPost, updateUserPost, deleteUserPost, getRemainingPosts } from "../services/postsService.js";
import { uploadImageBuffer } from "../services/cloudinaryService.js";

export const getPosts = asyncHandler(async (req, res) => {
  const page     = Number(req.query.page)     || 0;
  const pageSize = Math.min(Number(req.query.pageSize) || 5, 20);
  const category = req.query.category || undefined;
  const search   = req.query.search ? String(req.query.search).slice(0, 100) : undefined;
  const sort     = ["newest", "trending", "popular"].includes(req.query.sort) ? req.query.sort : "newest";
  const tag      = req.query.tag ? String(req.query.tag).slice(0, 80).toLowerCase() : undefined;
  res.json(await listPosts({ page, pageSize, category, search, userId: req.userId, sort, tag }));
});

export const getPostById = asyncHandler(async (req, res) => {
  res.json(await getPost(req.params.id, req.userId));
});

export const createPost = asyncHandler(async (req, res) => {
  if (req.file && req.file.size > MAX_IMAGE_BYTES)
    throw new HttpError(400, "Image must be 1 MB or smaller");

  let poll_options = null;
  if (req.body.poll_options) {
    try { poll_options = JSON.parse(req.body.poll_options); } catch { poll_options = null; }
  }

  const parsed = postCreateSchema.safeParse({
    title:        req.body.title    || null,
    content:      req.body.content,
    category:     req.body.category || undefined,
    event_date:   req.body.event_date || null,
    poll_options: poll_options || null,
  });
  if (!parsed.success)
    throw new HttpError(400, parsed.error.issues[0]?.message || "Invalid post data");

  await enforceRateLimit(req.userId, "post");

  let image_url = null;
  if (req.file) {
    const uploaded = await uploadImageBuffer(req.file.buffer);
    image_url = uploaded.url;
  }

  res.status(201).json(
    await createUserPost(req.userId, req.userName, { ...parsed.data, image_url }),
  );
});

export const updatePost = asyncHandler(async (req, res) => {
  const parsed = postUpdateSchema.safeParse({
    title:    req.body.title ?? null,
    content:  req.body.content,
    category: req.body.category || undefined,
  });
  if (!parsed.success)
    throw new HttpError(400, parsed.error.issues[0]?.message || "Invalid post data");
  res.json(await updateUserPost(req.params.id, req.userId, parsed.data));
});

export const deletePost = asyncHandler(async (req, res) => {
  res.json(await deleteUserPost(req.params.id, req.userId));
});

export const remainingPosts = asyncHandler(async (req, res) => {
  res.json({ remaining: await getRemainingPosts(req.userId) });
});
