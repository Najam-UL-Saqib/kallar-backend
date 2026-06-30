import webpush from "web-push";
import { env } from "../config/env.js";
import { supabaseAdmin } from "../config/supabase.js";

// Only configure VAPID if both keys are present
let pushEnabled = false;
if (env.vapidPublicKey && env.vapidPrivateKey) {
  webpush.setVapidDetails(env.vapidEmail, env.vapidPublicKey, env.vapidPrivateKey);
  pushEnabled = true;
}

export async function saveSubscription(userId, subscription) {
  const { endpoint, keys: { p256dh, auth } } = subscription;
  await supabaseAdmin
    .from("push_subscriptions")
    .upsert({ user_id: userId, endpoint, p256dh, auth }, { onConflict: "endpoint" });
}

export async function deleteSubscription(endpoint) {
  await supabaseAdmin.from("push_subscriptions").delete().eq("endpoint", endpoint);
}

export async function sendPushToUser(userId, title, body) {
  if (!pushEnabled) return;

  const { data: subs } = await supabaseAdmin
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", userId);

  if (!subs?.length) return;

  const payload = JSON.stringify({ title, body });

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        );
      } catch (err) {
        // Remove stale subscriptions (device unsubscribed / permission revoked)
        if (err.statusCode === 410 || err.statusCode === 404) {
          await supabaseAdmin.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        }
      }
    }),
  );
}
