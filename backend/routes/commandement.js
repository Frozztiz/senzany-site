const express = require("express");
const { GameDig } = require("gamedig");

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

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function normalizePlayer(player, index) {
  const raw = player && typeof player === "object" ? player : {};
  const name = String(raw.name || raw.player || raw.nickname || "").trim();

  return {
    id: String(raw.id ?? raw.raw?.id ?? index + 1),
    name: name || `Joueur ${index + 1}`,
    ping: toNumber(raw.ping ?? raw.raw?.ping),
    score: toNumber(raw.score ?? raw.raw?.score),
    timeSeconds: toNumber(
      raw.time ?? raw.duration ?? raw.raw?.time ?? raw.raw?.duration
    ),
  };
}

async function queryConnectedPlayers() {
  const configuration = getDayzConfiguration();
  const state = await GameDig.query({
    type: "dayz",
    host: configuration.host,
    port: configuration.queryPort,
    socketTimeout: 3000,
    attemptTimeout: 5000,
    maxRetries: 1,
  });

  const rawPlayers = Array.isArray(state?.players) ? state.players : [];
  const players = rawPlayers
    .map(normalizePlayer)
    .filter((player) => player.name);

  const reportedCount =
    toNumber(state?.numplayers) ??
    toNumber(state?.numPlayers) ??
    toNumber(state?.raw?.numplayers) ??
    players.length;

  const maxPlayers =
    toNumber(state?.maxplayers) ??
    toNumber(state?.maxPlayers) ??
    toNumber(state?.raw?.maxplayers) ??
    configuration.maxPlayers;

  const payload = {
    online: true,
    players,
    playerCount: reportedCount,
    maxPlayers,
    namesAvailable: players.length > 0 || reportedCount === 0,
    source: "direct-dayz-query",
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
