import { asyncHandler } from "../utils/asyncHandler.js";
import { HttpError } from "../middleware/errorHandler.js";
import { issueAdminSession, clearAdminSession } from "../middleware/adminAuth.js";
import { adminLoginSchema, postAdminUpsertSchema, directorySchema, MAX_IMAGE_BYTES } from "../utils/validators.js";
import {
  checkAdminPassword, adminListPosts, adminCreatePost, adminUpdatePost,
  adminDeletePost, adminListTable, adminDeleteRow, adminStats, adminPinPost,
} from "../services/adminService.js";
import { listReports, deleteReport } from "../services/reportsService.js";
import { uploadImageBuffer } from "../services/cloudinaryService.js";
import { createEntry, updateEntry, deleteEntry, listDirectory } from "../services/directoryService.js";

export const login = asyncHandler(async (req, res) => {
  const parsed = adminLoginSchema.safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, "Password required");
  if (!checkAdminPassword(parsed.data.password)) throw new HttpError(401, "Invalid password");
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

export const pinPost = asyncHandler(async (req, res) => {
  const pinned = req.body.pinned === true || req.body.pinned === "true";
  res.json(await adminPinPost(req.params.id, pinned));
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
  if (!req.file) throw new HttpError(400, "No file uploaded");
  if (req.file.size > MAX_IMAGE_BYTES) throw new HttpError(400, "Image must be 1 MB or smaller");
  const result = await uploadImageBuffer(req.file.buffer);
  res.json(result);
});

// Directory management
export const listDirectoryAdmin = asyncHandler(async (req, res) => {
  res.json(await listDirectory());
});

export const createDirectoryEntry = asyncHandler(async (req, res) => {
  const parsed = directorySchema.safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message || "Invalid data");
  res.status(201).json(await createEntry(parsed.data));
});

export const updateDirectoryEntry = asyncHandler(async (req, res) => {
  const parsed = directorySchema.safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message || "Invalid data");
  res.json(await updateEntry(req.params.id, parsed.data));
});

export const deleteDirectoryEntry = asyncHandler(async (req, res) => {
  res.json(await deleteEntry(req.params.id));
});
