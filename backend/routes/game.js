const express = require("express");
const rconService = require("../services/rconService");

const router = express.Router();

const DEFAULT_SERVER_HOST = "208.115.196.109";
const DEFAULT_GAME_PORT = 2302;
const DEFAULT_MAX_PLAYERS = 50;
const CACHE_DURATION_MS = 15000;

let cachedPayload = null;
let cacheExpiresAt = 0;
let inFlightQuery = null;

function getConfiguration() {
  const host =
    process.env.DAYZ_SERVER_HOST ||
    process.env.DAYZ_SERVER_IP ||
    DEFAULT_SERVER_HOST;

  const gamePort = Number(
    process.env.DAYZ_SERVER_PORT ||
      process.env.DAYZ_GAME_PORT ||
      DEFAULT_GAME_PORT
  );

  const fallbackMaxPlayers = Number(
    process.env.DAYZ_MAX_PLAYERS || DEFAULT_MAX_PLAYERS
  );

  return {
    host,
    gamePort,
    fallbackMaxPlayers,
  };
}

async function getFreshServerState(configuration) {
  const result = await rconService.getPlayers();
  const players = Array.isArray(result?.players) ? result.players : [];

  const payload = {
    online: true,
    degraded: false,
    players: players.length,
    maxPlayers: configuration.fallbackMaxPlayers,
    map: "chernarusplus",
    name: "Senzany",
    bots: 0,
    ping: 0,
    source: "battleye-rcon",
    serverAddress: `${configuration.host}:${configuration.gamePort}`,
    rconDiagnostics: result?.diagnostics || null,
    updatedAt: new Date().toISOString(),
  };

  cachedPayload = payload;
  cacheExpiresAt = Date.now() + CACHE_DURATION_MS;

  return payload;
}

router.get("/stats", async (req, res) => {
  const configuration = getConfiguration();

  res.set(
    "Cache-Control",
    "public, max-age=10, stale-while-revalidate=30"
  );

  if (cachedPayload && Date.now() < cacheExpiresAt) {
    return res.status(200).json({
      ...cachedPayload,
      source: "memory-cache",
    });
  }

  try {
    if (!inFlightQuery) {
      inFlightQuery = getFreshServerState(configuration).finally(() => {
        inFlightQuery = null;
      });
    }

    const payload = await inFlightQuery;
    return res.status(200).json(payload);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Impossible d’interroger le serveur RCON.";

    console.error("Erreur interrogation RCON pour l'accueil :", message);

    if (cachedPayload) {
      return res.status(200).json({
        ...cachedPayload,
        degraded: true,
        source: "stale-rcon-cache",
        error: message,
        updatedAt: new Date().toISOString(),
      });
    }

    return res.status(200).json({
      online: false,
      degraded: true,
      players: null,
      maxPlayers: configuration.fallbackMaxPlayers,
      map: "chernarusplus",
      name: "Senzany",
      bots: 0,
      ping: 0,
      source: "rcon-unavailable",
      serverAddress: `${configuration.host}:${configuration.gamePort}`,
      error: message,
      updatedAt: new Date().toISOString(),
    });
  }
});

router.get("/debug", async (req, res) => {
  const startedAt = Date.now();
  const configuration = getConfiguration();

  res.set("Cache-Control", "no-store");

  try {
    const result = await rconService.getPlayers();
    const players = Array.isArray(result?.players) ? result.players : [];

    return res.status(200).json({
      ok: true,
      configuration: {
        ...configuration,
        serverAddress: `${configuration.host}:${configuration.gamePort}`,
      },
      durationMs: Date.now() - startedAt,
      extracted: {
        players: players.length,
        maxPlayers: configuration.fallbackMaxPlayers,
      },
      source: "battleye-rcon",
      diagnostics: result?.diagnostics || null,
    });
  } catch (error) {
    return res.status(502).json({
      ok: false,
      configuration: {
        ...configuration,
        serverAddress: `${configuration.host}:${configuration.gamePort}`,
      },
      durationMs: Date.now() - startedAt,
      source: "battleye-rcon",
      error: {
        name: error?.name || "Error",
        message: error?.message || String(error),
        code: error?.code || null,
      },
    });
  }
});

module.exports = router;
