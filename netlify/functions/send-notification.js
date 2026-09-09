// netlify/functions/send-notification.js
//
// One endpoint, three jobs, all driven by js/notifications.js in the app:
//
//   GET  ?vapidPublicKey=1                       -> { publicKey }
//   POST { action: "subscribe", username, subscription }   -> save it
//   POST { action: "unsubscribe", endpoint }                -> remove it
//   POST { action: "send", title, body, excludeUsername }   -> push to everyone
//
// Requires two environment variables set in the Netlify site dashboard
// (Site settings → Environment variables), generated once with
// `npx web-push generate-vapid-keys`:
//   VAPID_PUBLIC_KEY
//   VAPID_PRIVATE_KEY
//   VAPID_SUBJECT (optional — defaults to a placeholder mailto: address)
//
// Until those are set, subscribe/send calls no-op safely (see
// vapidConfigured() in lib/push-helpers.js) rather than crashing the app.

import {
  vapidConfigured,
  saveSubscription,
  removeSubscription,
  sendToAll
} from "./lib/push-helpers.js";

export default async (req) => {
  const url = new URL(req.url);

  if (req.method === "GET" && url.searchParams.get("vapidPublicKey")) {
    return jsonResponse({ publicKey: process.env.VAPID_PUBLIC_KEY || null });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  let body;
  try {
    body = await req.json();
  } catch (e) {
    return jsonResponse({ error: "Invalid JSON body." }, 400);
  }

  const { action } = body || {};

  if (action === "subscribe") {
    if (!body.subscription) return jsonResponse({ error: "Missing subscription." }, 400);
    await saveSubscription(body.username, body.subscription);
    return jsonResponse({ ok: true });
  }

  if (action === "unsubscribe") {
    if (!body.endpoint) return jsonResponse({ error: "Missing endpoint." }, 400);
    await removeSubscription(body.endpoint);
    return jsonResponse({ ok: true });
  }

  if (action === "send") {
    if (!vapidConfigured()) {
      return jsonResponse({ ok: false, reason: "VAPID keys not configured on the server yet." }, 200);
    }
    const result = await sendToAll({
      title: body.title || "Ms Villa",
      body: body.body || "",
      excludeUsername: body.excludeUsername || null
    });
    return jsonResponse({ ok: true, ...result });
  }

  return jsonResponse({ error: "Unknown action." }, 400);
};

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

export const config = {
  path: "/.netlify/functions/send-notification"
};
