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

async function syncPublicGeometry(zoneId, centerX, centerZ, radiusM) {
  if (!zoneId) return;

  await supabaseRequest(
    `map_zones_public?id=eq.${encodeURIComponent(String(zoneId))}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        center_x: Number(centerX),
        center_z: Number(centerZ),
        radius_m: Math.min(60, Math.max(1, Number(radiusM) || 60)),
        updated_at: new Date().toISOString(),
      }),
    }
  );
}

function normalizeMembers(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    return value.split(/\r?\n|,/).map(v => v.trim()).filter(Boolean);
  }
  return [];
}

function validateZoneBody(body) {
  const publicName = String(body.public_name || "").trim();
  const zoneType = String(body.zone_type || "base").trim();
  const publicStatus = String(body.public_status || "validated").trim();
  const centerX = Number(body.center_x);
  const centerZ = Number(body.center_z);
  const radiusM = Number(body.radius_m ?? 60);

  if (!publicName) return { error: "Le nom public est obligatoire." };
  if (!["base","mapping","event","special"].includes(zoneType)) {
    return { error: "Type de zone invalide." };
  }
  if (!["validated","pending","hidden"].includes(publicStatus)) {
    return { error: "Statut invalide." };
  }
  if (
    !Number.isFinite(centerX) || !Number.isFinite(centerZ) ||
    centerX < 0 || centerX > 15360 || centerZ < 0 || centerZ > 15360
  ) {
    return { error: "Coordonnées Chernarus invalides." };
  }
  if (!Number.isFinite(radiusM) || radiusM < 1 || radiusM > 60) {
    return { error: "Le rayon doit être compris entre 1 et 60 mètres." };
  }

  return {
    value: {
      publicName, zoneType, publicStatus,
      centerX, centerZ, radiusM: Math.round(radiusM),
    },
  };
}

router.get("/", async (req, res, next) => {
  try {
    res.set("Cache-Control", "no-store");

    const [zones, requests] = await Promise.all([
      rpc("command_map_list"),
      supabaseRequest(
        "map_requests" +
        "?select=id,requester_steam_id,request_name,comment,center_x,center_z,radius_m,status,created_at,updated_at" +
        "&status=eq.pending" +
        "&order=created_at.asc",
        { method: "GET" }
      ),
    ]);

    return res.json({
      zones: Array.isArray(zones) ? zones : [],
      requests: Array.isArray(requests) ? requests : [],
    });
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const checked = validateZoneBody(req.body || {});
    if (checked.error) return res.status(400).json({ error: checked.error });

    const { publicName, zoneType, publicStatus, centerX, centerZ, radiusM } = checked.value;

    const zoneId = await rpc("command_map_create", {
      p_public_name: publicName,
      p_zone_type: zoneType,
      p_public_status: publicStatus,
      p_public_description: String(req.body.public_description || "").trim() || null,
      p_owner_name: String(req.body.owner_name || "").trim() || null,
      p_owner_steam_id: String(req.body.owner_steam_id || "").trim() || null,
      p_center_x: centerX,
      p_center_z: centerZ,
      p_radius_m: radiusM,
      p_members: normalizeMembers(req.body.members),
      p_staff_comment: String(req.body.staff_comment || "").trim() || null,
      p_actor: req.commandSteamId,
    });

    await syncPublicGeometry(zoneId, centerX, centerZ, radiusM);

    return res.status(201).json({ ok: true, id: zoneId });
  } catch (error) {
    next(error);
  }
});

router.patch("/:id", async (req, res, next) => {
  try {
    const zoneId = String(req.params.id || "").trim();
    const checked = validateZoneBody(req.body || {});
    if (!zoneId) return res.status(400).json({ error: "ID de zone manquant." });
    if (checked.error) return res.status(400).json({ error: checked.error });

    const { publicName, zoneType, publicStatus, centerX, centerZ, radiusM } = checked.value;

    const updated = await rpc("command_map_update", {
      p_zone_id: zoneId,
      p_public_name: publicName,
      p_zone_type: zoneType,
      p_public_status: publicStatus,
      p_public_description: String(req.body.public_description || "").trim() || null,
      p_owner_name: String(req.body.owner_name || "").trim() || null,
      p_owner_steam_id: String(req.body.owner_steam_id || "").trim() || null,
      p_center_x: centerX,
      p_center_z: centerZ,
      p_radius_m: radiusM,
      p_members: normalizeMembers(req.body.members),
      p_staff_comment: String(req.body.staff_comment || "").trim() || null,
      p_actor: req.commandSteamId,
    });

    if (!updated) return res.status(404).json({ error: "Zone introuvable." });
    await syncPublicGeometry(zoneId, centerX, centerZ, radiusM);
    return res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const zoneId = String(req.params.id || "").trim();
    if (!zoneId) return res.status(400).json({ error: "ID de zone manquant." });

    const deleted = await rpc("command_map_delete", {
      p_zone_id: zoneId,
      p_actor: req.commandSteamId,
    });

    if (!deleted) return res.status(404).json({ error: "Zone introuvable." });
    return res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

// Validation en un clic d'une demande joueur.
router.patch("/requests/:id/approve", async (req, res, next) => {
  try {
    const requestId = String(req.params.id || "").trim();
    if (!requestId) {
      return res.status(400).json({ error: "ID de demande manquant." });
    }

    const rows = await supabaseRequest(
      "map_requests" +
      "?select=id,requester_steam_id,request_name,comment,center_x,center_z,radius_m,status" +
      `&id=eq.${encodeURIComponent(requestId)}` +
      "&limit=1",
      { method: "GET" }
    );

    const request = Array.isArray(rows) ? rows[0] : null;
    if (!request) return res.status(404).json({ error: "Demande introuvable." });
    if (String(request.status) !== "pending") {
      return res.status(409).json({ error: "Cette demande n'est plus en attente." });
    }

    const zoneId = await rpc("command_map_create", {
      p_public_name: String(request.request_name || "Base joueur").trim(),
      p_zone_type: "base",
      p_public_status: "validated",
      p_public_description: null,
      p_owner_name: null,
      p_owner_steam_id: String(request.requester_steam_id || "").trim() || null,
      p_center_x: Number(request.center_x),
      p_center_z: Number(request.center_z),
      p_radius_m: Math.min(60, Math.max(1, Number(request.radius_m) || 60)),
      p_members: [],
      p_staff_comment: String(request.comment || "").trim() || null,
      p_actor: req.commandSteamId,
    });

    await syncPublicGeometry(
      zoneId,
      Number(request.center_x),
      Number(request.center_z),
      Math.min(60, Math.max(1, Number(request.radius_m) || 60))
    );

    await supabaseRequest(
      `map_requests?id=eq.${encodeURIComponent(requestId)}`,
      {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          status: "approved",
          updated_at: new Date().toISOString(),
        }),
      }
    );

    return res.json({ ok: true, zone_id: zoneId, request_id: requestId });
  } catch (error) {
    next(error);
  }
});

router.patch("/requests/:id/reject", async (req, res, next) => {
  try {
    const requestId = String(req.params.id || "").trim();
    if (!requestId) return res.status(400).json({ error: "ID de demande manquant." });

    await supabaseRequest(
      `map_requests?id=eq.${encodeURIComponent(requestId)}&status=eq.pending`,
      {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          status: "rejected",
          updated_at: new Date().toISOString(),
        }),
      }
    );

    return res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
