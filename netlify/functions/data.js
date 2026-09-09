// netlify/functions/data.js
//
// A tiny shared key/value store used by js/database.js (sset/sget) so that
// every resident's phone reads and writes the same house data — the
// equivalent of the shared `window.storage` this app used when it ran as a
// Claude artifact. Backed by Netlify Blobs, which is provisioned
// automatically for any site on Netlify (no extra setup or database to
// stand up).
//
// This function is not in the original three-function sketch the app was
// planned around — it's added here because a real multi-device deployment
// needs *some* shared backend for the data itself, separate from push
// notifications. If you'd rather use a different database, this is the
// only file that needs to change; js/database.js just expects
// GET ?key=... -> { value } and POST { key, value } -> { ok: true }.
//
// GET  /.netlify/functions/data?key=ms-villa:members  -> { value: <any|null> }
// POST /.netlify/functions/data   { key, value }       -> { ok: true }

import { getStore } from "@netlify/blobs";

const STORE_NAME = "ms-villa-data";

export default async (req) => {
  const store = getStore(STORE_NAME);
  const url = new URL(req.url);

  if (req.method === "GET") {
    const key = url.searchParams.get("key");
    if (!key) {
      return jsonResponse({ error: "Missing 'key' query parameter." }, 400);
    }
    const value = await store.get(key, { type: "json" }).catch(() => null);
    return jsonResponse({ value: value === undefined ? null : value });
  }

  if (req.method === "POST") {
    let body;
    try {
      body = await req.json();
    } catch (e) {
      return jsonResponse({ error: "Invalid JSON body." }, 400);
    }
    const { key, value } = body || {};
    if (!key) {
      return jsonResponse({ error: "Missing 'key' in request body." }, 400);
    }
    await store.setJSON(key, value === undefined ? null : value);
    return jsonResponse({ ok: true });
  }

  return jsonResponse({ error: "Method not allowed." }, 405);
};

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

export const config = {
  path: "/.netlify/functions/data"
};
