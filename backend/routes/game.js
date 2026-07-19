const express = require("express");

const router = express.Router();

const DEFAULT_SERVER_ADDRESS = "208.115.196.109:2302";
const DEFAULT_MAX_PLAYERS = 50;
const REQUEST_TIMEOUT_MS = 8000;

router.get("/stats", async (req, res) => {
  const apiKey = process.env.STEAM_API_KEY;
  const serverAddress =
    process.env.DAYZ_SERVER_ADDRESS || DEFAULT_SERVER_ADDRESS;
  const fallbackMaxPlayers = Number(
    process.env.DAYZ_MAX_PLAYERS || DEFAULT_MAX_PLAYERS
  );

  res.set("Cache-Control", "public, max-age=30, stale-while-revalidate=60");

  if (!apiKey) {
    return res.status(500).json({
      online: false,
      players: null,
      maxPlayers: fallbackMaxPlayers,
      map: "chernarusplus",
      source: "steam-web-api",
      error: "STEAM_API_KEY manquant dans le fichier .env du backend OVH.",
      updatedAt: new Date().toISOString(),
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const filter = encodeURIComponent(`\\gameaddr\\${serverAddress}`);
    const url =
      "https://api.steampowered.com/IGameServersService/GetServerList/v1/" +
      `?key=${encodeURIComponent(apiKey)}&filter=${filter}&limit=1`;

    const steamResponse = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": "Senzany-Portal/1.0",
      },
      signal: controller.signal,
    });

    if (!steamResponse.ok) {
      throw new Error(`Steam a répondu avec le statut ${steamResponse.status}`);
    }

    const data = await steamResponse.json();
    const servers = data?.response?.servers;

    if (!Array.isArray(servers) || servers.length === 0) {
      return res.status(200).json({
        online: false,
        players: null,
        maxPlayers: fallbackMaxPlayers,
        map: "chernarusplus",
        source: "steam-web-api",
        serverAddress,
        error: "Serveur introuvable dans l'API Steam.",
        updatedAt: new Date().toISOString(),
      });
    }

    const server = servers[0];

    return res.status(200).json({
      online: true,
      players: Number(server.players ?? 0),
      maxPlayers: Number(server.max_players ?? fallbackMaxPlayers),
      map: server.map || "chernarusplus",
      name: server.name || "Senzany",
      bots: Number(server.bots ?? 0),
      source: "steam-web-api",
      serverAddress,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    const message =
      error?.name === "AbortError"
        ? `Délai dépassé après ${REQUEST_TIMEOUT_MS} ms lors de l'appel à Steam.`
        : error?.message || "Impossible de contacter Steam.";

    console.error("Erreur Steam Web API DayZ :", message);

    return res.status(200).json({
      online: false,
      players: null,
      maxPlayers: fallbackMaxPlayers,
      map: "chernarusplus",
      source: "steam-web-api",
      serverAddress,
      error: message,
      updatedAt: new Date().toISOString(),
    });
  } finally {
    clearTimeout(timeout);
  }
});

module.exports = router;
