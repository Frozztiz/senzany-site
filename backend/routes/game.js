const express = require("express");
const { GameDig } = require("gamedig");

const router = express.Router();

const DEFAULT_SERVER_HOST = "208.115.196.109";
const DEFAULT_GAME_PORT = 2302;
const DEFAULT_QUERY_PORT = 2305;
const DEFAULT_MAX_PLAYERS = 50;

router.get("/stats", async (req, res) => {
  const host =
    process.env.DAYZ_SERVER_HOST ||
    DEFAULT_SERVER_HOST;

  const gamePort = Number(
    process.env.DAYZ_SERVER_PORT ||
    DEFAULT_GAME_PORT
  );

  const queryPort = Number(
    process.env.DAYZ_QUERY_PORT ||
    DEFAULT_QUERY_PORT
  );

  const fallbackMaxPlayers = Number(
    process.env.DAYZ_MAX_PLAYERS ||
    DEFAULT_MAX_PLAYERS
  );

  res.set(
    "Cache-Control",
    "public, max-age=30, stale-while-revalidate=60"
  );

  try {
    const state = await GameDig.query({
      type: "dayz",
      host,
      port: queryPort,
      socketTimeout: 4000,
      attemptTimeout: 8000,
      maxRetries: 1,
    });

    const connectedPlayers = Array.isArray(state.players)
      ? state.players.length
      : Number(state.numplayers || 0);

    return res.status(200).json({
      online: true,
      players: connectedPlayers,
      maxPlayers: Number(state.maxplayers || fallbackMaxPlayers),
      map: state.map || "chernarusplus",
      name: state.name || "Senzany",
      bots: Number(state.bots || 0),
      ping: Number(state.ping || 0),
      source: "direct-dayz-query",
      serverAddress: `${host}:${gamePort}`,
      queryAddress: `${host}:${queryPort}`,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Impossible d'interroger directement le serveur DayZ.";

    console.error(
      "Erreur interrogation directe serveur DayZ :",
      message
    );

    return res.status(200).json({
      online: false,
      players: null,
      maxPlayers: fallbackMaxPlayers,
      map: "chernarusplus",
      source: "direct-dayz-query",
      serverAddress: `${host}:${gamePort}`,
      queryAddress: `${host}:${queryPort}`,
      error: message,
      updatedAt: new Date().toISOString(),
    });
  }
});

module.exports = router;