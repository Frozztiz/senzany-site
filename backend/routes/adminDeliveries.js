const express = require("express");
const router = express.Router();

const deliveriesController = require("../controllers/deliveriesController");
const supabaseService = require("../services/supabaseService");

router.get("/players", async (req, res) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");

  try {
    const rows = await supabaseService.request(
      "user_links?select=steam_id,discord_username,created_at&order=discord_username.asc.nullslast&limit=1000",
      { method: "GET" }
    );

    const players = (Array.isArray(rows) ? rows : [])
      .map((row) => ({
        steamId: String(row.steam_id || "").trim(),
        playerName: String(row.discord_username || "").trim() || null
      }))
      .filter((row) => /^\d{17}$/.test(row.steamId));

    return res.json({ ok: true, players });
  } catch (error) {
    console.error("[LIVRAISONS] Liste des joueurs enregistrés indisponible :", error?.message || error);
    return res.status(502).json({
      error: "Impossible de charger les joueurs enregistrés."
    });
  }
});

router.get("/", deliveriesController.list);
router.post("/", deliveriesController.create);
router.get("/:id", deliveriesController.get);
router.patch("/:id", deliveriesController.update);
router.delete("/:id", deliveriesController.remove);

module.exports = router;