import { asyncHandler } from "../utils/asyncHandler.js";
import { HttpError } from "../middleware/errorHandler.js";
import { enforceRateLimit } from "../middleware/rateLimiter.js";
import { commentSchema } from "../utils/validators.js";
import {
  toggleLike, submitComment, deleteComment, toggleCommentLike,
  submitShare, getStats, listComments, toggleBookmark, listBookmarks, votePoll, getPollResults,
} from "../services/engagementService.js";

export const like = asyncHandler(async (req, res) => {
  await enforceRateLimit(req.userId, "like");
  res.json(await toggleLike(req.params.id, req.userId, req.userName));
});

export const comment = asyncHandler(async (req, res) => {
  const parsed = commentSchema.safeParse(req.body);
  if (!parsed.success)
    throw new HttpError(400, parsed.error.issues[0]?.message || "Invalid comment");
  await enforceRateLimit(req.userId, "comment");
  res.status(201).json(
    await submitComment(req.params.id, req.userId, req.userName, parsed.data),
  );
});

export const removeComment = asyncHandler(async (req, res) => {
  res.json(await deleteComment(req.params.id, req.params.commentId, req.userId));
});

export const commentLike = asyncHandler(async (req, res) => {
  res.json(await toggleCommentLike(req.params.commentId, req.userId));
});

export const share = asyncHandler(async (req, res) => {
  await enforceRateLimit(req.userId, "share");
  res.json(await submitShare(req.params.id, req.userId));
});

export const stats = asyncHandler(async (req, res) => {
  res.json(await getStats(req.params.id, req.userId));
});

export const comments = asyncHandler(async (req, res) => {
  res.json(await listComments(req.params.id, req.userId));
});

export const bookmark = asyncHandler(async (req, res) => {
  res.json(await toggleBookmark(req.params.id, req.userId));
});

export const bookmarks = asyncHandler(async (req, res) => {
  res.json(await listBookmarks(req.userId));
});

export const pollVote = asyncHandler(async (req, res) => {
  const optionIndex = Number(req.body.option_index);
  if (!Number.isInteger(optionIndex) || optionIndex < 0)
    throw new HttpError(400, "option_index must be a non-negative integer");
  res.json(await votePoll(req.params.id, req.userId, optionIndex));
});

export const pollResults = asyncHandler(async (req, res) => {
  res.json(await getPollResults(req.params.id, req.userId));
});
