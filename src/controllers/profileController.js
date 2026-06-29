import { asyncHandler } from "../utils/asyncHandler.js";
import { HttpError } from "../middleware/errorHandler.js";
import { getProfile, updateProfile, getUserPosts, getPublicProfile, getPublicUserPosts } from "../services/profileService.js";

export const profile = asyncHandler(async (req, res) => {
  res.json(await getProfile(req.userId));
});

export const updateProfileHandler = asyncHandler(async (req, res) => {
  const { name, bio } = req.body;
  if (name !== undefined && typeof name !== "string") throw new HttpError(400, "name must be a string");
  if (bio  !== undefined && typeof bio  !== "string") throw new HttpError(400, "bio must be a string");
  res.json(await updateProfile(req.userId, { name: name ?? null, bio: bio ?? null }));
});

export const myPosts = asyncHandler(async (req, res) => {
  const page     = Number(req.query.page)     || 0;
  const pageSize = Math.min(Number(req.query.pageSize) || 10, 20);
  res.json(await getUserPosts(req.userId, { page, pageSize }));
});

export const publicProfile = asyncHandler(async (req, res) => {
  res.json(await getPublicProfile(req.params.userId));
});

export const publicUserPosts = asyncHandler(async (req, res) => {
  const page     = Number(req.query.page)     || 0;
  const pageSize = Math.min(Number(req.query.pageSize) || 10, 20);
  res.json(await getPublicUserPosts(req.params.userId, { page, pageSize }));
});
