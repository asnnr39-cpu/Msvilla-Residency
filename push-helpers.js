// netlify/functions/lib/push-helpers.js
//
// Shared by send-notification.js (on-demand pushes triggered from the app)
// and scheduled-reminders.js (cron-triggered meeting/duty reminders), so
// the "who do we have subscriptions for, and how do we actually send"
// logic lives in exactly one place. Not a function itself — it's a plain
// module imported by the two functions that are.

import webpush from "web-push";
import { getStore } from "@netlify/blobs";

const SUBS_STORE = "ms-villa-push-subs";
const SUBS_KEY = "subscriptions"; // single JSON array: [{ username, subscription }]

export function vapidConfigured() {
  return !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

export function configureWebPush() {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:admin@example.com",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

export async function getSubscriptions() {
  const store = getStore(SUBS_STORE);
  const list = await store.get(SUBS_KEY, { type: "json" }).catch(() => null);
  return Array.isArray(list) ? list : [];
}

export async function saveSubscription(username, subscription) {
  const store = getStore(SUBS_STORE);
  const list = await getSubscriptions();
  const withoutDupe = list.filter((s) => s.subscription.endpoint !== subscription.endpoint);
  withoutDupe.push({ username: username || null, subscription });
  await store.setJSON(SUBS_KEY, withoutDupe);
}

export async function removeSubscription(endpoint) {
  const store = getStore(SUBS_STORE);
  const list = await getSubscriptions();
  await store.setJSON(SUBS_KEY, list.filter((s) => s.subscription.endpoint !== endpoint));
}

// Sends { title, body } to every stored subscription (optionally skipping
// one username — e.g. don't notify the admin who just made the change).
// Prunes subscriptions the push service reports as gone (404/410).
export async function sendToAll({ title, body, excludeUsername, data }) {
  if (!vapidConfigured()) {
    return { sent: 0, failed: 0, skipped: true, reason: "VAPID keys not configured" };
  }
  configureWebPush();
  const subs = await getSubscriptions();
  const payload = JSON.stringify({ title, body, data: data || {} });

  let sent = 0, failed = 0;
  const stale = [];

  await Promise.all(subs.map(async ({ username, subscription }) => {
    if (excludeUsername && username === excludeUsername) return;
    try {
      await webpush.sendNotification(subscription, payload);
      sent++;
    } catch (err) {
      failed++;
      if (err.statusCode === 404 || err.statusCode === 410) {
        stale.push(subscription.endpoint);
      }
    }
  }));

  if (stale.length) {
    const store = getStore(SUBS_STORE);
    const fresh = (await getSubscriptions()).filter((s) => !stale.includes(s.subscription.endpoint));
    await store.setJSON(SUBS_KEY, fresh);
  }

  return { sent, failed, skipped: false };
}
