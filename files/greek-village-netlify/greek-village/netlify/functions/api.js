// netlify/functions/api.js
// Backend API for the Greek Village deals site.
// Uses Netlify Blobs (Netlify's built-in database) to store everything.
// Endpoint: /api   (mapped in netlify.toml + config below)

import { getStore } from "@netlify/blobs";

const STORE = "greekvillage";

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

// which "tables" are simple arrays vs single objects
const ARRAYS = new Set(["deals", "gallery", "leads"]);
const OBJECTS = new Set(["content"]);

export default async (req) => {
  const store = getStore(STORE);
  const url = new URL(req.url);
  const type = url.searchParams.get("type") || "all";
  const method = req.method;

  try {
    // ---- READ ----
    if (method === "GET") {
      if (type === "all") {
        const [deals, gallery, content] = await Promise.all([
          store.get("deals", { type: "json" }),
          store.get("gallery", { type: "json" }),
          store.get("content", { type: "json" }),
        ]);
        return json({ deals: deals || [], gallery: gallery || [], content: content || {} });
      }
      const data = await store.get(type, { type: "json" });
      return json(data ?? (OBJECTS.has(type) ? {} : []));
    }

    // ---- CREATE / UPDATE ----
    if (method === "POST") {
      const body = await req.json();

      if (OBJECTS.has(type)) {
        await store.setJSON(type, body);
        return json({ ok: true, item: body });
      }
      if (ARRAYS.has(type)) {
        const arr = (await store.get(type, { type: "json" })) || [];
        const i = arr.findIndex((x) => x.id === body.id);
        if (i >= 0) arr[i] = body;
        else arr.unshift(body);
        await store.setJSON(type, arr);
        return json({ ok: true, item: body });
      }
      return json({ error: "unknown type" }, 400);
    }

    // ---- DELETE ----
    if (method === "DELETE") {
      const id = url.searchParams.get("id");
      const arr = (await store.get(type, { type: "json" })) || [];
      await store.setJSON(type, arr.filter((x) => x.id !== id));
      return json({ ok: true });
    }

    // ---- PATCH (toggle lead status) ----
    if (method === "PATCH") {
      const id = url.searchParams.get("id");
      const arr = (await store.get(type, { type: "json" })) || [];
      const it = arr.find((x) => x.id === id);
      if (it) {
        it.status = it.status === "done" ? "new" : "done";
        await store.setJSON(type, arr);
      }
      return json({ ok: true });
    }

    return json({ error: "method not allowed" }, 405);
  } catch (e) {
    return json({ error: String(e && e.message ? e.message : e) }, 500);
  }
};

export const config = { path: "/api" };
