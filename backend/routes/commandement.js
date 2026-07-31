const express = require("express");
const rconService = require("../services/rconService");

const router = express.Router();

const commandAuth = require("../middleware/commandAuth");
const { verifySteamId } = require("../utils/steamSession");
const { isCommandAuthorized } = require("../utils/commandAccess");

const DEFAULT_SERVER_HOST = "208.115.196.109";
const DEFAULT_QUERY_PORT = 2303;
const DEFAULT_MAX_PLAYERS = 50;
const PLAYERS_CACHE_DURATION_MS = 15000;

let cachedPlayersPayload = null;
let playersCacheExpiresAt = 0;
let playersQueryInFlight = null;

function getDayzConfiguration() {
  return {
    host:
      process.env.DAYZ_SERVER_HOST ||
      process.env.DAYZ_SERVER_IP ||
      DEFAULT_SERVER_HOST,
    queryPort: Number(process.env.DAYZ_QUERY_PORT || DEFAULT_QUERY_PORT),
    maxPlayers: Number(process.env.DAYZ_MAX_PLAYERS || DEFAULT_MAX_PLAYERS),
  };
}

async function queryConnectedPlayers() {
  const configuration = getDayzConfiguration();
  const result = await rconService.getPlayers();
  const players = Array.isArray(result.players) ? result.players : [];

  const payload = {
    online: true,
    players,
    playerCount: players.length,
    maxPlayers: configuration.maxPlayers,
    namesAvailable: true,
    source: "battleye-rcon",
    updatedAt: new Date().toISOString(),
  };

  cachedPlayersPayload = payload;
  playersCacheExpiresAt = Date.now() + PLAYERS_CACHE_DURATION_MS;

  return payload;
}

router.get("/access", (req, res) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");

  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) {
    return res.status(500).json({
      loggedIn: false,
      authorized: false,
      error: "Configuration de session manquante."
    });
  }

  const steamId = verifySteamId(
    req.cookies?.senzany_session,
    sessionSecret
  );

  if (!steamId) {
    return res.status(401).json({
      loggedIn: false,
      authorized: false,
      error: "Connexion Steam requise."
    });
  }

  if (!isCommandAuthorized(steamId)) {
    console.warn(`[COMMANDEMENT] Accès refusé pour SteamID ${steamId}`);
    return res.status(403).json({
      loggedIn: true,
      authorized: false,
      steamId: String(steamId),
      error: "Niveau d'autorisation insuffisant."
    });
  }

  return res.json({
    loggedIn: true,
    authorized: true,
    steamId: String(steamId),
    clearance: "ALPHA"
  });
});

router.get("/players", commandAuth, async (req, res) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");

  if (cachedPlayersPayload && Date.now() < playersCacheExpiresAt) {
    return res.json({ ...cachedPlayersPayload, source: "memory-cache" });
  }

  try {
    if (!playersQueryInFlight) {
      playersQueryInFlight = queryConnectedPlayers().finally(() => {
        playersQueryInFlight = null;
      });
    }

    return res.json(await playersQueryInFlight);
  } catch (error) {
    const message = error?.message || "Impossible d’interroger le serveur DayZ.";
    console.error("[COMMANDEMENT] Liste des joueurs indisponible :", message);

    if (cachedPlayersPayload) {
      return res.json({
        ...cachedPlayersPayload,
        degraded: true,
        source: "stale-memory-cache",
        error: message,
        updatedAt: new Date().toISOString(),
      });
    }

    return res.status(502).json({
      online: false,
      players: [],
      playerCount: null,
      maxPlayers: getDayzConfiguration().maxPlayers,
      namesAvailable: false,
      error: message,
      updatedAt: new Date().toISOString(),
    });
  }
});

module.exports = router;
