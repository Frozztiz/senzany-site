const express = require("express");
const router = express.Router();

function supabaseConfig() {
  const url = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL ou SUPABASE_SECRET_KEY manquante.");
  }
  return { url, key };
}

async function supabaseRequest(path, options = {}) {
  const { url, key } = supabaseConfig();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }

  if (!response.ok) {
    const error = new Error(`Supabase HTTP ${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

async function rpc(functionName, payload = {}) {
  const { url, key } = supabaseConfig();
  const response = await fetch(`${url}/rest/v1/rpc/${functionName}`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }

  if (!response.ok) {
    const error = new Error(`Supabase RPC HTTP ${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

function publicZoneKey(zone) {
  const x = Number(zone?.center_x);
  const z = Number(zone?.center_z);
  if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
  return `${Math.round(x)}:${Math.round(z)}`;
}

function sanitizeValidatedZones(rows) {
  const seen = new Set();
  const result = [];

  for (const zone of (Array.isArray(rows) ? rows : [])) {
    const status = String(zone?.public_status ?? zone?.status ?? "").toLowerCase();
    const type = String(zone?.zone_type ?? "base").toLowerCase();
    const x = Number(zone?.center_x);
    const z = Number(zone?.center_z);

    if (type !== "base") continue;
    if (status !== "validated" && status !== "approved") continue;
    if (!Number.isFinite(x) || !Number.isFinite(z)) continue;

    const key = publicZoneKey(zone);
    if (!key || seen.has(key)) continue;
    seen.add(key);

    result.push({
      id: zone?.id || null,
      public_name: "Base occupée",
      zone_type: "base",
      public_status: "validated",
      public_description: null,
      center_x: x,
      center_z: z,
      radius_m: Math.min(60, Math.max(1, Number(zone?.radius_m) || 60)),
    });
  }

  return result;
}

// PUBLIC : toutes les bases validées sont visibles par tous les joueurs,
// mais aucune donnée privée (SteamID, propriétaire, membres, commentaire staff)
// ne quitte cette route.
router.get("/", async (req, res, next) => {
  try {
    res.set("Cache-Control", "no-store");

    const [commandZones, requests] = await Promise.all([
      rpc("command_map_list"),
      supabaseRequest(
        "map_requests" +
        "?select=id,center_x,center_z,radius_m,status" +
        "&status=eq.pending" +
        "&order=created_at.asc",
        { method: "GET" }
      ),
    ]);

    const zones = sanitizeValidatedZones(commandZones);
    const publicRequests = (Array.isArray(requests) ? requests : [])
      .filter((r) => String(r?.status || "pending") === "pending")
      .map((r) => ({
        id: r?.id || null,
        center_x: Number(r?.center_x),
        center_z: Number(r?.center_z),
        radius_m: Math.min(60, Math.max(1, Number(r?.radius_m) || 60)),
        status: "pending",
      }))
      .filter((r) => Number.isFinite(r.center_x) && Number.isFinite(r.center_z));

    return res.json({ zones, requests: publicRequests });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
