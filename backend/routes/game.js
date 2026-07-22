const express = require("express");
const { GameDig } = require("gamedig");

const router = express.Router();

const DEFAULT_SERVER_HOST = "208.115.196.109";
const DEFAULT_GAME_PORT = 2302;
const DEFAULT_QUERY_PORTS = [2305, 2302, 27016, 27017];
const DEFAULT_MAX_PLAYERS = 50;

let lastSuccessfulState = null;

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

async function queryDayzServer(host, ports) {
  const errors = [];

  for (const port of ports) {
    try {
      const state = await GameDig.query({
        type: "dayz",
        host,
        port,
        socketTimeout: 3500,
        attemptTimeout: 6500,
        maxRetries: 0,
      });

      return {
        state,
        port,
      };
    } catch (error) {
      errors.push({
        port,
        message:
          error instanceof Error
            ? error.message
            : String(error),
      });
    }
  }

  const finalError = new Error(
    errors
      .map(
        (entry) =>
          `Port ${entry.port}: ${entry.message}`
      )
      .join(" | ")
  );

  finalError.attempts = errors;

  throw finalError;
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
    "public, max-age=20, stale-while-revalidate=60"
  );

  try {
    const { state, port } =
      await queryDayzServer(host, queryPorts);

    const connectedPlayers =
      Array.isArray(state.players)
        ? state.players.length
        : Number(state.numplayers || 0);

    const payload = {
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
      queryAddress: `${host}:${port}`,
      updatedAt: new Date().toISOString(),
    };

    lastSuccessfulState = payload;

    return res.status(200).json(payload);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Impossible d'interroger directement le serveur DayZ.";

    console.error(
      "Erreur interrogation serveur DayZ :",
      message
    );

    if (lastSuccessfulState) {
      return res.status(200).json({
        ...lastSuccessfulState,
        degraded: true,
        source: "cached-dayz-query",
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