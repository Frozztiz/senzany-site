const express = require("express");
const router = express.Router();

const topServeursService = require("../services/topServeursService");
const supabaseService = require("../services/supabaseService");
const { verifySteamId } = require("../utils/steamSession");

router.get("/stats", async (req, res) => {
  try {
    const stats = await topServeursService.getStats();
    return res.json(stats);
  } catch (err) {
    console.error("Top-Serveurs stats:", err);

    return res.status(500).json({
      error: err.message,
    });
  }
});

router.get("/my-votes", async (req, res) => {
  res.set("Cache-Control", "no-store");

  try {
    const secret = process.env.SESSION_SECRET;

    if (!secret) {
      return res.status(500).json({
        error: "SESSION_SECRET manquant.",
      });
    }

    const steamId = verifySteamId(
      req.cookies?.senzany_session,
      secret
    );

    if (!steamId) {
      return res.status(401).json({
        error: "Connexion Steam requise.",
      });
    }

    const discordLink =
      await supabaseService.getLinkBySteamId(steamId);

    console.log("========== MY VOTES ==========");
    console.log("SteamID :", steamId);
    console.log(
      "Discord Link :",
      JSON.stringify(discordLink, null, 2)
    );

    if (!discordLink?.discord_id) {
      return res.json({
        linked: false,
        found: false,
        votes: null,
        position: null,
      });
    }

    const result =
      await topServeursService.getPlayerVotes({
        discordId: discordLink.discord_id,
        discordUsername: discordLink.discord_username,
      });

    console.log(
      "Résultat TopServeurs :",
      JSON.stringify(result, null, 2)
    );
    console.log("==============================");

    return res.json(result);
  } catch (err) {
    console.error("Top-Serveurs my-votes:", err);

    return res.status(502).json({
      error: "Classement Top-Serveurs indisponible.",
    });
  }
});

module.exports = router;