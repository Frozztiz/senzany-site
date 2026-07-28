const express = require("express");
const { GameDig } = require("gamedig");

const router = express.Router();

const DEFAULT_SERVER_HOST = "208.115.196.109";
const DEFAULT_GAME_PORT = 2302;
const DEFAULT_QUERY_PORT = 2303;
const DEFAULT_MAX_PLAYERS = 50;

const CACHE_DURATION_MS = 20000;

let cachedPayload = null;
let cacheExpiresAt = 0;
let inFlightQuery = null;

function toValidNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

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

  const queryPort = Number(
    process.env.DAYZ_QUERY_PORT || DEFAULT_QUERY_PORT
  );

  const fallbackMaxPlayers = Number(
    process.env.DAYZ_MAX_PLAYERS || DEFAULT_MAX_PLAYERS
  );

  return {
    host,
    gamePort,
    queryPort,
    fallbackMaxPlayers,
  };
}

function extractPlayerCount(state) {
  const candidates = [
    state?.numplayers,
    state?.numPlayers,
    state?.raw?.numplayers,
    state?.raw?.numPlayers,
    state?.raw?.clients,
    state?.raw?.online,
    state?.raw?.rules?.numplayers,
    state?.raw?.rules?.players,
  ];

  for (const candidate of candidates) {
    const value = toValidNumber(candidate);
    if (value !== null) return value;
  }

  if (Array.isArray(state?.players)) {
    return state.players.length;
  }

  return null;
}

function extractMaxPlayers(state, fallbackMaxPlayers) {
  const candidates = [
    state?.maxplayers,
    state?.maxPlayers,
    state?.raw?.maxplayers,
    state?.raw?.maxPlayers,
    state?.raw?.max_clients,
    state?.raw?.rules?.maxplayers,
    state?.raw?.rules?.maxPlayers,
  ];

  for (const candidate of candidates) {
    const value = toValidNumber(candidate);
    if (value !== null && value > 0) return value;
  }

  return fallbackMaxPlayers;
}

async function queryDayzServer(host, queryPort) {
  return GameDig.query({
    type: "dayz",
    host,
    port: queryPort,
    socketTimeout: 2500,
    attemptTimeout: 4500,
    maxRetries: 1,
  });
}

function buildOnlinePayload({
  state,
  host,
  gamePort,
  queryPort,
  fallbackMaxPlayers,
}) {
  const players = extractPlayerCount(state);
  const maxPlayers = extractMaxPlayers(state, fallbackMaxPlayers);

  return {
    online: true,
    degraded: players === null,
    players,
    maxPlayers,
    map: state?.map || state?.raw?.map || "chernarusplus",
    name: state?.name || state?.raw?.name || "Senzany",
    bots: toValidNumber(state?.bots) ?? 0,
    ping: toValidNumber(state?.ping) ?? 0,
    source: "direct-dayz-query",
    serverAddress: `${host}:${gamePort}`,
    queryAddress: `${host}:${queryPort}`,
    updatedAt: new Date().toISOString(),
  };
}

async function getFreshServerState(configuration) {
  const state = await queryDayzServer(
    configuration.host,
    configuration.queryPort
  );

  const payload = buildOnlinePayload({
    state,
    ...configuration,
  });

  cachedPayload = payload;
  cacheExpiresAt = Date.now() + CACHE_DURATION_MS;

  return payload;
}

router.get("/stats", async (req, res) => {
  const configuration = getConfiguration();

  res.set(
    "Cache-Control",
    "public, max-age=15, stale-while-revalidate=45"
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
        : "Impossible d’interroger le serveur DayZ.";

    console.error("Erreur interrogation serveur DayZ :", message);

    if (cachedPayload) {
      return res.status(200).json({
        ...cachedPayload,
        degraded: true,
        source: "stale-memory-cache",
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
      source: "query-unavailable",
      serverAddress: `${configuration.host}:${configuration.gamePort}`,
      queryAddress: `${configuration.host}:${configuration.queryPort}`,
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
    const state = await queryDayzServer(
      configuration.host,
      configuration.queryPort
    );

    return res.status(200).json({
      ok: true,
      configuration: {
        ...configuration,
        serverAddress: `${configuration.host}:${configuration.gamePort}`,
        queryAddress: `${configuration.host}:${configuration.queryPort}`,
      },
      durationMs: Date.now() - startedAt,
      extracted: {
        players: extractPlayerCount(state),
        maxPlayers: extractMaxPlayers(
          state,
          configuration.fallbackMaxPlayers
        ),
      },
      stateKeys: Object.keys(state || {}),
      state,
    });
  } catch (error) {
    return res.status(502).json({
      ok: false,
      configuration: {
        ...configuration,
        serverAddress: `${configuration.host}:${configuration.gamePort}`,
        queryAddress: `${configuration.host}:${configuration.queryPort}`,
      },
      durationMs: Date.now() - startedAt,
      error: {
        name: error?.name || "Error",
        message: error?.message || String(error),
        code: error?.code || null,
        stack: error?.stack || null,
      },
    });
  }
});

module.exports = router;
