const express = require("express");
const router = express.Router();

const { verifySteamId } = require("../utils/steamSession");

function config() {
  return {
    url: String(process.env.SUPABASE_URL || "").replace(/\/$/, ""),
    key: process.env.SUPABASE_SECRET_KEY,
    sessionSecret: process.env.SESSION_SECRET,
  };
}

async function supabaseInsert(row) {
  const { url, key } = config();

  if (!url || !key) {
    throw new Error("Configuration Supabase manquante.");
  }

  const response = await fetch(`${url}/rest/v1/map_requests`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(row),
  });

  const text = await response.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    const error = new Error(`Supabase HTTP ${response.status}`);
    error.data = data;
    throw error;
  }

  return Array.isArray(data) ? data[0] : data;
}

router.post("/", async (req, res, next) => {
  try {
    const { sessionSecret } = config();

    if (!sessionSecret) {
      return res.status(500).json({
        error: "Configuration de session manquante.",
      });
    }

    const steamId = verifySteamId(
      req.cookies?.senzany_session,
      sessionSecret
    );

    if (!steamId) {
      return res.status(401).json({
        error: "Connexion Steam requise.",
      });
    }

    const requestName = String(req.body?.request_name || "").trim();
    const comment = String(req.body?.comment || "").trim();
    const x = Number(req.body?.center_x);
    const z = Number(req.body?.center_z);

    if (!requestName || requestName.length > 80) {
      return res.status(400).json({
        error: "Nom de demande invalide.",
      });
    }

    if (comment.length > 500) {
      return res.status(400).json({
        error: "Commentaire trop long.",
      });
    }

    if (
      !Number.isFinite(x) ||
      !Number.isFinite(z) ||
      x < 0 ||
      x > 15360 ||
      z < 0 ||
      z > 15360
    ) {
      return res.status(400).json({
        error: "Emplacement invalide.",
      });
    }

    const created = await supabaseInsert({
      requester_steam_id: String(steamId),
      request_name: requestName,
      comment: comment || null,
      center_x: x,
      center_z: z,
      radius_m: 60,
      status: "pending",
    });

    return res.status(201).json({
      ok: true,
      request: {
        id: created?.id,
        status: created?.status || "pending",
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
