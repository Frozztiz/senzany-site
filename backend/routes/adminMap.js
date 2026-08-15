const express = require("express");
const router = express.Router();
const flagpoleSnapshotService = require("../services/flagpoleSnapshotService");

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


function sameCoordinate(a, b, tolerance = 1) {
  return Math.abs(Number(a) - Number(b)) <= tolerance;
}

function findExistingValidatedBase(zones, request) {
  const rows = Array.isArray(zones) ? zones : [];
  const steamId = String(request?.requester_steam_id || "").trim();

  return rows.find((zone) => {
    const zoneStatus = String(zone?.public_status ?? zone?.status ?? "").toLowerCase();
    const zoneType = String(zone?.zone_type ?? "base").toLowerCase();
    const ownerSteamId = String(zone?.owner_steam_id || "").trim();

    if (zoneStatus && zoneStatus !== "validated" && zoneStatus !== "approved") return false;
    if (zoneType !== "base") return false;
    if (!sameCoordinate(zone?.center_x, request?.center_x)) return false;
    if (!sameCoordinate(zone?.center_z, request?.center_z)) return false;

    // Si le SteamID est présent des deux côtés, il doit correspondre.
    if (steamId && ownerSteamId && steamId !== ownerSteamId) return false;

    return true;
  }) || null;
}


function validatedZoneKey(zone) {
  const x = Number(zone?.center_x);
  const z = Number(zone?.center_z);
  if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
  // 1 mètre de tolérance : deux lignes au même emplacement = une seule implantation.
  return `${Math.round(x)}:${Math.round(z)}`;
}

function dedupeValidatedZones(rows) {
  const source = Array.isArray(rows) ? rows : [];
  const seen = new Set();
  const result = [];

  for (const zone of source) {
    const status = String(zone?.public_status ?? zone?.status ?? "").toLowerCase();
    const type = String(zone?.zone_type ?? "base").toLowerCase();

    if (type !== "base" || (status && status !== "validated" && status !== "approved")) {
      result.push(zone);
      continue;
    }

    const key = validatedZoneKey(zone);
    if (!key) {
      result.push(zone);
      continue;
    }

    if (seen.has(key)) continue;
    seen.add(key);
    result.push(zone);
  }

  return result;
}

async function assertNoDuplicateValidatedBase(centerX, centerZ, ignoreId = null) {
  const zones = await rpc("command_map_list");
  const key = `${Math.round(Number(centerX))}:${Math.round(Number(centerZ))}`;

  const duplicate = (Array.isArray(zones) ? zones : []).find((zone) => {
    if (ignoreId && String(zone?.id) === String(ignoreId)) return false;

    const status = String(zone?.public_status ?? zone?.status ?? "").toLowerCase();
    const type = String(zone?.zone_type ?? "base").toLowerCase();
    if (type !== "base" || (status && status !== "validated" && status !== "approved")) return false;

    return validatedZoneKey(zone) === key;
  });

  if (duplicate) {
    const error = new Error("Une base validée existe déjà à cet emplacement.");
    error.status = 409;
    throw error;
  }
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

    const rawZones = Array.isArray(zones) ? zones : [];
    const safeZones = dedupeValidatedZones(rawZones);
    const safeRequests = Array.isArray(requests) ? requests : [];
    const snapshot = flagpoleSnapshotService.loadSnapshot();
    const classified = flagpoleSnapshotService.classifyFlagpoles(
      snapshot.flagpoles,
      safeZones,
      safeRequests
    );

    return res.json({
      zones: safeZones,
      requests: safeRequests,
      flagpoles: classified.flagpoles,
      flagpoleStats: classified.stats,
      flagpoleSnapshot: {
        agentId: snapshot.agentId,
        receivedAt: snapshot.receivedAt,
        count: snapshot.count
      }
    });
  } catch (error) {
    next(error);
  }
});


// Diagnostic Commandement : doublons exacts/proches de bases validées.
// Cette route ne supprime rien ; elle permet de vérifier les données avant nettoyage.
router.get("/duplicates", async (req, res, next) => {
  try {
    const zones = await rpc("command_map_list");
    const rows = (Array.isArray(zones) ? zones : []).filter((zone) => {
      const status = String(zone?.public_status ?? zone?.status ?? "").toLowerCase();
      const type = String(zone?.zone_type ?? "base").toLowerCase();
      return type === "base" && (!status || status === "validated" || status === "approved");
    });

    const groups = [];
    const used = new Set();

    for (let i = 0; i < rows.length; i++) {
      if (used.has(i)) continue;
      const group = [rows[i]];

      for (let j = i + 1; j < rows.length; j++) {
        if (used.has(j)) continue;

        if (
          sameCoordinate(rows[i]?.center_x, rows[j]?.center_x) &&
          sameCoordinate(rows[i]?.center_z, rows[j]?.center_z)
        ) {
          group.push(rows[j]);
          used.add(j);
        }
      }

      if (group.length > 1) {
        used.add(i);
        groups.push({
          center_x: Number(rows[i]?.center_x),
          center_z: Number(rows[i]?.center_z),
          count: group.length,
          zones: group.map((zone) => ({
            id: zone?.id || null,
            public_name: zone?.public_name || null,
            owner_steam_id: zone?.owner_steam_id || null,
            created_at: zone?.created_at || null,
          })),
        });
      }
    }

    return res.json({
      ok: true,
      validatedRows: rows.length,
      duplicateGroups: groups.length,
      duplicates: groups,
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

    if (zoneType === "base" && publicStatus === "validated") {
      await assertNoDuplicateValidatedBase(centerX, centerZ);
    }

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

    if (zoneType === "base" && publicStatus === "validated") {
      await assertNoDuplicateValidatedBase(centerX, centerZ, zoneId);
    }

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

    // IMPORTANT : validation idempotente.
    // Si une tentative précédente a créé la zone mais a échoué ensuite
    // (ex. erreur de droit lors de syncPublicGeometry), on réutilise la zone
    // existante au lieu d'en créer une deuxième.
    const existingZones = await rpc("command_map_list");
    const existingZone = findExistingValidatedBase(existingZones, request);

    let zoneId = existingZone?.id || null;

    if (!zoneId) {
      zoneId = await rpc("command_map_create", {
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
    }

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
