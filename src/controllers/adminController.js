import { asyncHandler } from "../utils/asyncHandler.js";
import { HttpError } from "../middleware/errorHandler.js";
import { issueAdminSession, clearAdminSession } from "../middleware/adminAuth.js";
import { adminLoginSchema, postAdminUpsertSchema, MAX_IMAGE_BYTES } from "../utils/validators.js";
import {
  checkAdminPassword,
  adminListPosts,
  adminCreatePost,
  adminUpdatePost,
  adminDeletePost,
  adminListTable,
  adminDeleteRow,
  adminStats,
} from "../services/adminService.js";
import { listReports, deleteReport } from "../services/reportsService.js";
import { uploadImageBuffer } from "../services/cloudinaryService.js";

export const login = asyncHandler(async (req, res) => {
  const parsed = adminLoginSchema.safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, "Password required");
  if (!checkAdminPassword(parsed.data.password)) {
    throw new HttpError(401, "Invalid password");
  }
  issueAdminSession(res);
  res.json({ ok: true });
});

export const logout = asyncHandler(async (req, res) => {
  clearAdminSession(res);
  res.json({ ok: true });
});

export const stats = asyncHandler(async (req, res) => {
  res.json(await adminStats());
});

export const listPosts = asyncHandler(async (req, res) => {
  res.json(await adminListPosts());
});

export const createPost = asyncHandler(async (req, res) => {
  const parsed = postAdminUpsertSchema.safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message || "Invalid post");
  res.status(201).json(await adminCreatePost(parsed.data));
});

export const updatePost = asyncHandler(async (req, res) => {
  const parsed = postAdminUpsertSchema.safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message || "Invalid post");
  res.json(await adminUpdatePost(req.params.id, parsed.data));
});

export const deletePost = asyncHandler(async (req, res) => {
  res.json(await adminDeletePost(req.params.id));
});

export const listTable = asyncHandler(async (req, res) => {
  res.json(await adminListTable(req.params.table));
});

export const deleteRow = asyncHandler(async (req, res) => {
  res.json(await adminDeleteRow(req.params.table, req.params.id));
});

export const reports = asyncHandler(async (req, res) => {
  res.json(await listReports());
});

export const dismissReport = asyncHandler(async (req, res) => {
  res.json(await deleteReport(req.params.id));
});

export const uploadImage = asyncHandler(async (req, res) => {
  if (!req.file) throw new HttpError(400, "Image file required");
  if (req.file.size > MAX_IMAGE_BYTES) throw new HttpError(400, "Image must be 1MB or smaller");
  res.json(await uploadImageBuffer(req.file.buffer));
});
