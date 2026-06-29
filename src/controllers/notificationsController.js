import { asyncHandler } from "../utils/asyncHandler.js";
import { listNotifications, markAllRead, unreadCount } from "../services/notificationsService.js";

export const list = asyncHandler(async (req, res) => {
  res.json(await listNotifications(req.userId));
});

export const readAll = asyncHandler(async (req, res) => {
  res.json(await markAllRead(req.userId));
});

export const count = asyncHandler(async (req, res) => {
  res.json({ count: await unreadCount(req.userId) });
});
