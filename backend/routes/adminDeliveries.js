const express = require("express");
const router = express.Router();

const deliveriesController = require("../controllers/deliveriesController");
const supabaseService = require("../services/supabaseService");

function cleanSteamId(value) {
  const steamId = String(value || "").trim();
  return /^\d{17}$/.test(steamId) ? steamId : "";
}

function cleanName(value) {
  const name = String(value || "").trim();
  return name || null;
}

router.get("/players", async (req, res) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");

  try {
    const [
      links,
      deliveries,
      wallets,
      ledger,
      rankings
    ] = await Promise.all([
      supabaseService.request(
        "user_links?select=steam_id,discord_username,created_at&limit=5000",
        { method: "GET" }
      ),

      supabaseService.request(
        "deliveries?select=steam_id,player_name,created_at&order=created_at.desc&limit=5000",
        { method: "GET" }
      ),

      supabaseService.request(
        "vote_wallets?select=steam_id&limit=5000",
        { method: "GET" }
      ),

      supabaseService.request(
        "vote_wallet_ledger?select=steam_id&limit=5000",
        { method: "GET" }
      ),

      supabaseService.request(
        "monthly_vote_rankings?select=steam_id,player_name,created_at&order=created_at.desc&limit=5000",
        { method: "GET" }
      )
    ]);

    const playersBySteamId = new Map();

    function ensurePlayer(steamId) {
      const id = cleanSteamId(steamId);

      if (!id) {
        return null;
      }

      if (!playersBySteamId.has(id)) {
        playersBySteamId.set(id, {
          steamId: id,
          playerName: null,
          namePriority: 0
        });
      }

      return playersBySteamId.get(id);
    }

    function setPlayerName(steamId, playerName, priority) {
      const player = ensurePlayer(steamId);

      if (!player) {
        return;
      }

      const name = cleanName(playerName);

      if (!name) {
        return;
      }

      if (!player.playerName || priority > player.namePriority) {
        player.playerName = name;
        player.namePriority = priority;
      }
    }

    /*
     * Priorité des noms :
     *
     * 3 = user_links / pseudo Discord
     * 2 = dernière livraison connue
     * 1 = classement mensuel
     */

    for (const row of Array.isArray(rankings) ? rankings : []) {
      setPlayerName(row.steam_id, row.player_name, 1);
    }

    for (const row of Array.isArray(deliveries) ? deliveries : []) {
      setPlayerName(row.steam_id, row.player_name, 2);
    }

    for (const row of Array.isArray(links) ? links : []) {
      setPlayerName(row.steam_id, row.discord_username, 3);
    }

    /*
     * Ces tables peuvent contenir des SteamID sans nom.
     * On les conserve tout de même dans la liste.
     */

    for (const row of Array.isArray(wallets) ? wallets : []) {
      ensurePlayer(row.steam_id);
    }

    for (const row of Array.isArray(ledger) ? ledger : []) {
      ensurePlayer(row.steam_id);
    }

    const players = [...playersBySteamId.values()]
      .map(({ steamId, playerName }) => ({
        steamId,
        playerName
      }))
      .sort((a, b) => {
        const nameA = a.playerName || a.steamId;
        const nameB = b.playerName || b.steamId;

        return nameA.localeCompare(nameB, "fr", {
          sensitivity: "base"
        });
      });

    console.log(
      `[LIVRAISONS] ${players.length} joueur(s) connu(s) disponible(s) dans le sélecteur.`
    );

    return res.json({
      ok: true,
      players
    });
  } catch (error) {
    console.error(
      "[LIVRAISONS] Liste des joueurs enregistrés indisponible :",
      error?.message || error
    );

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