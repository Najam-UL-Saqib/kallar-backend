import { asyncHandler } from "../utils/asyncHandler.js";
import { HttpError } from "../middleware/errorHandler.js";
import { enforceRateLimit } from "../middleware/rateLimiter.js";
import { commentSchema } from "../utils/validators.js";
import { toggleLike, submitComment, submitShare, getStats, listComments } from "../services/engagementService.js";

export const like = asyncHandler(async (req, res) => {
  await enforceRateLimit(req.deviceId, "like");
  const result = await toggleLike(req.params.id, req.deviceId);
  res.json(result);
});

export const comment = asyncHandler(async (req, res) => {
  const parsed = commentSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new HttpError(400, parsed.error.issues[0]?.message || "Invalid comment");
  }
  await enforceRateLimit(req.deviceId, "comment");
  const result = await submitComment(req.params.id, req.deviceId, parsed.data);
  res.status(201).json(result);
});

export const share = asyncHandler(async (req, res) => {
  await enforceRateLimit(req.deviceId, "share");
  const result = await submitShare(req.params.id, req.deviceId);
  res.json(result);
});

export const stats = asyncHandler(async (req, res) => {
  res.json(await getStats(req.params.id, req.deviceId));
});

export const comments = asyncHandler(async (req, res) => {
  res.json(await listComments(req.params.id, req.deviceId));
});
