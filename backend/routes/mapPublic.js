const express = require("express");
const { verifySteamId } = require("../utils/steamSession");

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

function currentSteamId(req) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) return null;
  return verifySteamId(req.cookies?.senzany_session, secret);
}

// PUBLIC : coordonnées minimales nécessaires à l'affichage.
// Aucune donnée privée propriétaire / SteamID / membres / commentaire staff.
router.get("/", async (req, res, next) => {
  try {
    res.set("Cache-Control", "no-store");

    const [zones, requests] = await Promise.all([
      supabaseRequest(
        "map_zones_public" +
        "?select=id,public_name,zone_type,public_status,public_description,center_x,center_z,radius_m" +
        "&is_visible=eq.true" +
        "&public_status=neq.hidden" +
        "&order=created_at.asc",
        { method: "GET" }
      ),
      supabaseRequest(
        "map_requests" +
        "?select=id,center_x,center_z,radius_m,status" +
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

// Demande d'implantation joueur.
router.post("/requests", async (req, res, next) => {
  try {
    const steamId = currentSteamId(req);
    if (!steamId) {
      return res.status(401).json({ error: "Connexion Steam requise." });
    }

    const requestName = String(req.body?.request_name || "").trim();
    const comment = String(req.body?.comment || "").trim();
    const centerX = Number(req.body?.center_x);
    const centerZ = Number(req.body?.center_z);

    if (!requestName || requestName.length > 80) {
      return res.status(400).json({ error: "Nom de demande invalide." });
    }
    if (comment.length > 500) {
      return res.status(400).json({ error: "Commentaire trop long." });
    }
    if (
      !Number.isFinite(centerX) || !Number.isFinite(centerZ) ||
      centerX < 0 || centerX > 15360 ||
      centerZ < 0 || centerZ > 15360
    ) {
      return res.status(400).json({ error: "Coordonnées Chernarus invalides." });
    }

    const inserted = await supabaseRequest("map_requests", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        requester_steam_id: String(steamId),
        request_name: requestName,
        comment: comment || null,
        center_x: Number(centerX.toFixed(2)),
        center_z: Number(centerZ.toFixed(2)),
        radius_m: 60,
        status: "pending",
      }),
    });

    return res.status(201).json({
      ok: true,
      request: Array.isArray(inserted) ? inserted[0] || null : inserted,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/requests/mine", async (req, res, next) => {
  try {
    const steamId = currentSteamId(req);
    if (!steamId) {
      return res.status(401).json({ error: "Connexion Steam requise." });
    }

    const rows = await supabaseRequest(
      "map_requests" +
      "?select=id,request_name,comment,center_x,center_z,radius_m,status,created_at,updated_at" +
      `&requester_steam_id=eq.${encodeURIComponent(String(steamId))}` +
      "&order=created_at.desc",
      { method: "GET" }
    );

    return res.json({ requests: Array.isArray(rows) ? rows : [] });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
