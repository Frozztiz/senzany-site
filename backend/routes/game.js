const express = require("express");
const { GameDig } = require("gamedig");

const router = express.Router();

const DEFAULT_SERVER_HOST = "208.115.196.109";
const DEFAULT_GAME_PORT = 2302;
const DEFAULT_QUERY_PORTS = [2305, 2302, 27016, 27017];
const DEFAULT_MAX_PLAYERS = 50;

const CACHE_DURATION_MS = 20000;

let cachedPayload = null;
let cacheExpiresAt = 0;
let inFlightQuery = null;

function uniquePorts(values) {
  return [
    ...new Set(
      values
        .map((value) => Number(value))
        .filter(
          (value) =>
            Number.isInteger(value) &&
            value > 0 &&
            value <= 65535
        )
    ),
  ];
}

function buildQueryPorts() {
  const configuredPorts = String(
    process.env.DAYZ_QUERY_PORTS || ""
  )
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return uniquePorts([
    process.env.DAYZ_QUERY_PORT,
    ...configuredPorts,
    ...DEFAULT_QUERY_PORTS,
  ]);
}

async function querySinglePort(host, port) {
  const state = await GameDig.query({
    type: "dayz",
    host,
    port,
    socketTimeout: 1600,
    attemptTimeout: 2800,
    maxRetries: 0,
  });

  return {
    state,
    port,
  };
}

async function queryDayzServer(host, ports) {
  const queries = ports.map((port) =>
    querySinglePort(host, port)
  );

  try {
    return await Promise.any(queries);
  } catch (aggregateError) {
    const messages = Array.isArray(
      aggregateError?.errors
    )
      ? aggregateError.errors.map(
          (error, index) =>
            `Port ${ports[index]} : ${
              error instanceof Error
                ? error.message
                : String(error)
            }`
        )
      : ["Aucun port de requête n’a répondu."];

    throw new Error(messages.join(" | "));
  }
}

function buildOnlinePayload({
  state,
  queryPort,
  host,
  gamePort,
  fallbackMaxPlayers,
}) {
  const playerList = Array.isArray(state.players)
    ? state.players
    : [];

  const connectedPlayers =
    playerList.length > 0
      ? playerList.length
      : Number(state.numplayers || 0);

  return {
    online: true,
    degraded: false,
    players: connectedPlayers,
    maxPlayers: Number(
      state.maxplayers || fallbackMaxPlayers
    ),
    map: state.map || "chernarusplus",
    name: state.name || "Senzany",
    bots: Number(state.bots || 0),
    ping: Number(state.ping || 0),
    source: "direct-dayz-query",
    serverAddress: `${host}:${gamePort}`,
    queryAddress: `${host}:${queryPort}`,
    updatedAt: new Date().toISOString(),
  };
}

async function getFreshServerState({
  host,
  gamePort,
  queryPorts,
  fallbackMaxPlayers,
}) {
  const { state, port } = await queryDayzServer(
    host,
    queryPorts
  );

  const payload = buildOnlinePayload({
    state,
    queryPort: port,
    host,
    gamePort,
    fallbackMaxPlayers,
  });

  cachedPayload = payload;
  cacheExpiresAt =
    Date.now() + CACHE_DURATION_MS;

  return payload;
}

router.get("/stats", async (req, res) => {
  const host =
    process.env.DAYZ_SERVER_HOST ||
    DEFAULT_SERVER_HOST;

  const gamePort = Number(
    process.env.DAYZ_SERVER_PORT ||
      DEFAULT_GAME_PORT
  );

  const fallbackMaxPlayers = Number(
    process.env.DAYZ_MAX_PLAYERS ||
      DEFAULT_MAX_PLAYERS
  );

  const queryPorts = buildQueryPorts();

  res.set(
    "Cache-Control",
    "public, max-age=15, stale-while-revalidate=45"
  );

  if (
    cachedPayload &&
    Date.now() < cacheExpiresAt
  ) {
    return res.status(200).json({
      ...cachedPayload,
      source: "memory-cache",
    });
  }

  try {
    if (!inFlightQuery) {
      inFlightQuery = getFreshServerState({
        host,
        gamePort,
        queryPorts,
        fallbackMaxPlayers,
      }).finally(() => {
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

    console.error(
      "Erreur interrogation serveur DayZ :",
      message
    );

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
      online: true,
      degraded: true,
      players: null,
      maxPlayers: fallbackMaxPlayers,
      map: "chernarusplus",
      name: "Senzany",
      source: "query-unavailable",
      serverAddress: `${host}:${gamePort}`,
      attemptedQueryPorts: queryPorts,
      error: message,
      updatedAt: new Date().toISOString(),
    });
  }
});

module.exports = router;