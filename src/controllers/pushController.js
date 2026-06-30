import { asyncHandler } from "../utils/asyncHandler.js";
import { saveSubscription, deleteSubscription } from "../services/pushService.js";
import { env } from "../config/env.js";

export const getVapidKey = (_req, res) => {
  res.json({ publicKey: env.vapidPublicKey ?? null });
};

export const subscribe = asyncHandler(async (req, res) => {
  const { subscription } = req.body;
  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return res.status(400).json({ error: "Invalid subscription object" });
  }
  await saveSubscription(req.session.userId, subscription);
  res.json({ ok: true });
});

export const unsubscribe = asyncHandler(async (req, res) => {
  const { endpoint } = req.body;
  if (endpoint) await deleteSubscription(endpoint);
  res.json({ ok: true });
});
