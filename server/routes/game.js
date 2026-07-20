const express = require("express");
const cacheService = require("../services/cacheService");

const router = express.Router();

const DEFAULT_SERVER_ADDRESS = "208.115.196.109:2302";
const DEFAULT_MAX_PLAYERS = 50;
const REQUEST_TIMEOUT_MS = 8000;
const CACHE_NAME = "game-stats";

router.get("/stats", async (req, res) => {
  const apiKey = process.env.STEAM_API_KEY;

  const serverAddress =
    process.env.DAYZ_SERVER_ADDRESS ||
    DEFAULT_SERVER_ADDRESS;

  const fallbackMaxPlayers = Number(
    process.env.DAYZ_MAX_PLAYERS ||
    DEFAULT_MAX_PLAYERS
  );

  res.set(
    "Cache-Control",
    "public, max-age=30, stale-while-revalidate=60"
  );

  if (!apiKey) {
    return sendCachedResponse(
      res,
      "STEAM_API_KEY absente du fichier .env.",
      serverAddress,
      fallbackMaxPlayers
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS
  );

  try {
    const filter = encodeURIComponent(
      `\\gameaddr\\${serverAddress}`
    );

    const url =
      "https://api.steampowered.com/IGameServersService/GetServerList/v1/" +
      `?key=${encodeURIComponent(apiKey)}` +
      `&filter=${filter}` +
      "&limit=1";

    const steamResponse = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": "Senzany-Portal/1.0",
      },
      signal: controller.signal,
    });

    if (!steamResponse.ok) {
      throw new Error(
        `Steam a répondu avec le statut ${steamResponse.status}`
      );
    }

    const data = await steamResponse.json();
    const servers = data?.response?.servers;

    if (!Array.isArray(servers) || servers.length === 0) {
      const offlineData = {
        online: false,
        players: 0,
        maxPlayers: fallbackMaxPlayers,
        map: "chernarusplus",
        name: "Senzany",
        bots: 0,
        source: "steam-web-api",
        serverAddress,
        error: "Serveur introuvable dans l’API Steam.",
        stale: false,
        updatedAt: new Date().toISOString(),
      };

      await cacheService
        .saveCache(CACHE_NAME, offlineData)
        .catch((error) => {
          console.error(
            "[Game] Impossible d'enregistrer le cache :",
            error.message
          );
        });

      return res.status(200).json(offlineData);
    }

    const server = servers[0];

    const responseData = {
      online: true,
      players: Number(server.players ?? 0),
      maxPlayers: Number(
        server.max_players ?? fallbackMaxPlayers
      ),
      map: server.map || "chernarusplus",
      name: server.name || "Senzany",
      bots: Number(server.bots ?? 0),
      source: "steam-web-api",
      serverAddress,
      stale: false,
      updatedAt: new Date().toISOString(),
    };

    await cacheService
      .saveCache(CACHE_NAME, responseData)
      .catch((error) => {
        console.error(
          "[Game] Impossible d'enregistrer le cache :",
          error.message
        );
      });

    return res.status(200).json(responseData);
  } catch (error) {
    const message =
      error?.name === "AbortError"
        ? `Délai dépassé après ${REQUEST_TIMEOUT_MS} ms lors de l'appel à Steam.`
        : error?.message ||
          "Impossible de contacter Steam.";

    console.error(
      "[Game] Steam indisponible, tentative d'utilisation du cache :",
      message
    );

    return sendCachedResponse(
      res,
      message,
      serverAddress,
      fallbackMaxPlayers
    );
  } finally {
    clearTimeout(timeout);
  }
});

async function sendCachedResponse(
  res,
  errorMessage,
  serverAddress,
  fallbackMaxPlayers
) {
  const cachedPayload = await cacheService.loadCache(CACHE_NAME);

  if (cachedPayload?.data) {
    const cachedAt = cachedPayload.savedAt || null;

    console.warn(
      `[Game] Réponse Steam indisponible : utilisation du cache du ${cachedAt}.`
    );

    return res.status(200).json({
      ...cachedPayload.data,
      source: "steam-cache",
      stale: true,
      cacheUpdatedAt: cachedAt,
      error: errorMessage,
      updatedAt: new Date().toISOString(),
    });
  }

  return res.status(200).json({
    online: false,
    players: null,
    maxPlayers: fallbackMaxPlayers,
    map: "chernarusplus",
    name: "Senzany",
    bots: 0,
    source: "unavailable",
    serverAddress,
    stale: true,
    error: errorMessage,
    updatedAt: new Date().toISOString(),
  });
}

module.exports = router;
