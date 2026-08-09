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

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    const error = new Error(`Supabase HTTP ${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

// PUBLIC : volontairement aucune coordonnée, aucun SteamID,
// aucun propriétaire, aucun membre, aucun commentaire staff.
router.get("/", async (req, res, next) => {
  try {
    res.set("Cache-Control", "no-store");

    const rows = await supabaseRequest(
      "map_zones_public" +
      "?select=id,public_name,zone_type,public_status,public_description" +
      "&is_visible=eq.true" +
      "&public_status=neq.hidden" +
      "&order=created_at.asc",
      { method: "GET" }
    );

    return res.json({
      zones: Array.isArray(rows) ? rows : [],
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
