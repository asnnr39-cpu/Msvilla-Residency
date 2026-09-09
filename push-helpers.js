// netlify/functions/lib/push-helpers.js
//
// Shared push-notification helpers used by:
// - send-notification.js
// - scheduled-reminders.js

import webpush from "web-push";
import { getStore } from "@netlify/blobs";

const SUBS_STORE = "ms-villa-push-subs";
const SUBS_KEY = "subscriptions";

/**
 * Check whether VAPID credentials are configured.
 */
export function vapidConfigured() {
  return Boolean(
    process.env.VAPID_PUBLIC_KEY &&
    process.env.VAPID_PRIVATE_KEY
  );
}

/**
 * Configure Web Push.
 */
export function configureWebPush() {
  if (!vapidConfigured()) {
    throw new Error("VAPID keys are not configured");
  }

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:admin@example.com",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

/**
 * Get all saved push subscriptions.
 */
export async function getSubscriptions() {
  const store = getStore(SUBS_STORE);

  try {
    const list = await store.get(SUBS_KEY, {
      type: "json",
    });

    return Array.isArray(list) ? list : [];
  } catch (error) {
    console.error("Failed to read push subscriptions:", error);
    return [];
  }
}

/**
 * Save or update a push subscription.
 */
export async function saveSubscription(username, subscription) {
  if (!subscription?.endpoint) {
    throw new Error("Invalid push subscription");
  }

  const store = getStore(SUBS_STORE);
  const list = await getSubscriptions();

  const updatedList = list.filter(
    (item) =>
      item?.subscription?.endpoint !== subscription.endpoint
  );

  updatedList.push({
    username: username || null,
    subscription,
  });

  await store.setJSON(SUBS_KEY, updatedList);

  return {
    success: true,
    count: updatedList.length,
  };
}

/**
 * Remove a push subscription by endpoint.
 */
export async function removeSubscription(endpoint) {
  if (!endpoint) {
    return;
  }

  const store = getStore(SUBS_STORE);
  const list = await getSubscriptions();

  const updatedList = list.filter(
    (item) =>
      item?.subscription?.endpoint !== endpoint
  );

  await store.setJSON(SUBS_KEY, updatedList);
}

/**
 * Send a notification to all stored subscriptions.
 *
 * excludeUsername:
 *   Optional username to skip.
 *
 * data:
 *   Optional additional data sent with the notification.
 */
export async function sendToAll({
  title,
  body,
  excludeUsername,
  data = {},
}) {
  if (!vapidConfigured()) {
    console.warn("VAPID keys are not configured.");

    return {
      sent: 0,
      failed: 0,
      skipped: true,
      reason: "VAPID keys not configured",
    };
  }

  configureWebPush();

  const subscriptions = await getSubscriptions();

  if (!subscriptions.length) {
    return {
      sent: 0,
      failed: 0,
      skipped: false,
      reason: "No push subscriptions found",
    };
  }

  const payload = JSON.stringify({
    title: title || "Notification",
    body: body || "",
    data,
  });

  let sent = 0;
  let failed = 0;

  const staleEndpoints = [];

  await Promise.all(
    subscriptions.map(async (item) => {
      const username = item?.username;
      const subscription = item?.subscription;

      if (!subscription?.endpoint) {
        failed++;
        return;
      }

      if (
        excludeUsername &&
        username === excludeUsername
      ) {
        return;
      }

      try {
        await webpush.sendNotification(
          subscription,
          payload
        );

        sent++;
      } catch (error) {
        failed++;

        console.error(
          `Push notification failed for ${username || "unknown user"}:`,
          error
        );

        // 404/410 means the subscription is no longer valid.
        if (
          error?.statusCode === 404 ||
          error?.statusCode === 410
        ) {
          staleEndpoints.push(subscription.endpoint);
        }
      }
    })
  );

  // Remove expired subscriptions.
  if (staleEndpoints.length > 0) {
    const store = getStore(SUBS_STORE);

    const currentSubscriptions =
      await getSubscriptions();

    const freshSubscriptions =
      currentSubscriptions.filter(
        (item) =>
          !staleEndpoints.includes(
            item?.subscription?.endpoint
          )
      );

    await store.setJSON(
      SUBS_KEY,
      freshSubscriptions
    );
  }

  return {
    sent,
    failed,
    skipped: false,
  };
}
