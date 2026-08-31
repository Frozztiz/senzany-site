const express = require("express");
const rconService = require("../services/rconService");
const supabaseService = require("../services/supabaseService");
const playerSessionService = require("../services/playerSessionService");
const topServeursService = require("../services/topServeursService");
const voteAliasService = require("../services/voteAliasService");
const voteWalletService = require("../services/voteWalletService");

const router = express.Router();

const commandAuth = require("../middleware/commandAuth");
const { verifySteamId } = require("../utils/steamSession");
const { isCommandAuthorized } = require("../utils/commandAccess");

const DEFAULT_SERVER_HOST = "g02.fiveminehosting.com";
const DEFAULT_QUERY_PORT = 27016;
const DEFAULT_MAX_PLAYERS = 64;
const PLAYERS_CACHE_DURATION_MS = 15000;

let cachedPlayersPayload = null;
let playersCacheExpiresAt = 0;
let playersQueryInFlight = null;

// Suivi en mémoire de l'heure d'arrivée des joueurs.
// Le compteur repart à zéro uniquement lors d'un redémarrage du backend.
const playerSessions = new Map();
const PLAYER_SESSION_GRACE_MS = 120000;
let sessionsHydrated = false;
let sessionsHydrationPromise = null;

function normalizePlayerName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("fr-FR");
}

function portalIdentityFromLink(link, overrides = {}) {
  if (!link?.steam_id) return null;

  const steamId = String(link.steam_id);

  return {
    matched: true,
    steamLinked: true,
    steamId,
    steamName: overrides.steamName || null,
    steamProfileUrl: overrides.steamProfileUrl || null,
    discordLinked: Boolean(link.discord_id),
    discordId: link.discord_id ? String(link.discord_id) : null,
    discordUsername: link.discord_username || null,
    linkedAt: link.created_at || null,
    battleyeGuid: link.battleye_guid || null,
    matchMethod: overrides.matchMethod || "battleye-guid",
    isStaff: isCommandAuthorized(steamId)
  };
}

async function getPortalIdentityByBattleyeGuid(guid) {
  const cleanGuid = String(guid || "").trim().toLowerCase();
  if (!/^[a-f0-9]{32}$/.test(cleanGuid)) return null;

  const rows = await supabaseService.request(
    `user_links?battleye_guid=eq.${encodeURIComponent(cleanGuid)}&select=steam_id,discord_id,discord_username,discord_avatar,created_at,battleye_guid&limit=2`,
    { method: "GET" }
  );

  if (!Array.isArray(rows) || rows.length === 0) return null;

  if (rows.length > 1) {
    return {
      matched: false,
      ambiguous: true,
      matchMethod: "battleye-guid"
    };
  }

  return portalIdentityFromLink(rows[0], {
    matchMethod: "battleye-guid"
  });
}

async function getPortalIdentityByPlayerName(playerName) {
  const normalizedTarget = normalizePlayerName(playerName);
  if (!normalizedTarget) return null;

  const links = await supabaseService.request(
    "user_links?select=steam_id,discord_id,discord_username,discord_avatar,created_at,battleye_guid&limit=1000",
    { method: "GET" }
  );

  if (!Array.isArray(links) || links.length === 0) return null;

  const apiKey = process.env.STEAM_API_KEY;
  if (!apiKey) throw new Error("STEAM_API_KEY est manquante.");

  const ids = [...new Set(links.map((row) => String(row.steam_id || "")).filter(Boolean))];
  const profiles = [];

  for (let index = 0; index < ids.length; index += 100) {
    const params = new URLSearchParams({
      key: apiKey,
      steamids: ids.slice(index, index + 100).join(",")
    });

    const response = await fetch(
      `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?${params}`
    );

    if (!response.ok) throw new Error(`Steam HTTP ${response.status}`);

    const data = await response.json();

    profiles.push(
      ...(Array.isArray(data?.response?.players)
        ? data.response.players
        : [])
    );
  }

  const matches = profiles.filter(
    (profile) =>
      normalizePlayerName(profile.personaname) === normalizedTarget
  );

  if (matches.length !== 1) {
    return {
      matched: false,
      ambiguous: matches.length > 1,
      matchMethod: "exact-steam-name"
    };
  }

  const profile = matches[0];

  const link = links.find(
    (row) => String(row.steam_id) === String(profile.steamid)
  );

  if (!link) return null;

  return portalIdentityFromLink(link, {
    steamName: profile.personaname || null,
    steamProfileUrl: profile.profileurl || null,
    matchMethod: "exact-steam-name"
  });
}

async function getPortalIdentityForPlayer(player) {
  const byGuid = await getPortalIdentityByBattleyeGuid(player?.guid);
  if (byGuid?.matched || byGuid?.ambiguous) return byGuid;

  return getPortalIdentityByPlayerName(player?.name);
}

async function getCurrentPlayer(playerId) {
  const id = String(playerId || "").trim();

  let players = Array.isArray(cachedPlayersPayload?.players)
    ? cachedPlayersPayload.players
    : [];

  let player = players.find(
    (entry) => String(entry.id) === id
  );

  if (!player) {
    const payload = await queryConnectedPlayers();
    players = payload.players;

    player = players.find(
      (entry) => String(entry.id) === id
    );
  }

  return player || null;
}

async function hydratePlayerSessions() {
  if (sessionsHydrated) return;

  if (sessionsHydrationPromise) {
    return sessionsHydrationPromise;
  }

  sessionsHydrationPromise = (async () => {
    try {
      const rows =
        await playerSessionService.loadRecentOnlineSessions();

      for (const row of rows) {
        const sessionKey =
          String(row.session_key || "").toLowerCase();

        if (!sessionKey) continue;

        const session =
          playerSessionService.rowToSession(row);

        if (!session.connectedAt || !session.lastSeenAt) {
          continue;
        }

        playerSessions.set(sessionKey, session);
      }

      console.log(
        `[COMMANDEMENT] ${playerSessions.size} session(s) RCON restaurée(s) depuis Supabase.`
      );
    } catch (error) {
      // Le module continue en mémoire si la table n'est pas encore installée.
      console.error(
        "[COMMANDEMENT] Restauration des sessions Supabase impossible :",
        error?.message || error
      );
    } finally {
      sessionsHydrated = true;
      sessionsHydrationPromise = null;
    }
  })();

  return sessionsHydrationPromise;
}

async function enrichPlayersWithSessionTime(players) {
  await hydratePlayerSessions();

  const now = Date.now();
  const nowIso = new Date(now).toISOString();

  const connectedKeys = new Set();
  const rowsToPersist = [];

  const enrichedPlayers = players.map((player) => {
    const sessionKey = String(
      player.guid ||
        `${player.name}:${player.ip || "unknown"}`
    ).toLowerCase();

    connectedKeys.add(sessionKey);

    const existing = playerSessions.get(sessionKey);

    const session = existing || {
      connectedAt: now,
      lastSeenAt: now
    };

    session.lastSeenAt = now;
    session.playerName = player.name;
    session.guid = player.guid || null;

    playerSessions.set(sessionKey, session);

    rowsToPersist.push({
      session_key: sessionKey,
      battleye_guid: player.guid || null,
      player_name: player.name,
      connected_at: new Date(
        session.connectedAt
      ).toISOString(),
      last_seen_at: nowIso,
      disconnected_at: null,
      is_online: true,
      updated_at: nowIso
    });

    return {
      ...player,
      connectedAt: new Date(
        session.connectedAt
      ).toISOString(),
      timeSeconds: Math.max(
        0,
        Math.floor(
          (now - session.connectedAt) / 1000
        )
      ),
      status: "online"
    };
  });

  const offlineKeys = [];

  for (const [sessionKey, session] of playerSessions.entries()) {
    if (
      !connectedKeys.has(sessionKey) &&
      now - session.lastSeenAt >
        PLAYER_SESSION_GRACE_MS
    ) {
      playerSessions.delete(sessionKey);
      offlineKeys.push(sessionKey);
    }
  }

  try {
    await playerSessionService.upsertSessions(
      rowsToPersist
    );

    await playerSessionService.markOffline(
      offlineKeys,
      nowIso
    );
  } catch (error) {
    // Une panne Supabase ne doit jamais empêcher la supervision RCON.
    console.error(
      "[COMMANDEMENT] Sauvegarde des sessions Supabase impossible :",
      error?.message || error
    );
  }

  return enrichedPlayers;
}

function getDayzConfiguration() {
  return {
    host:
      process.env.DAYZ_SERVER_HOST ||
      process.env.DAYZ_SERVER_IP ||
      DEFAULT_SERVER_HOST,

    queryPort: Number(
      process.env.DAYZ_QUERY_PORT ||
        DEFAULT_QUERY_PORT
    ),

    maxPlayers: Number(
      process.env.DAYZ_MAX_PLAYERS ||
        DEFAULT_MAX_PLAYERS
    )
  };
}

async function queryConnectedPlayers() {
  const configuration = getDayzConfiguration();

  const result = await rconService.getPlayers();

  const rawPlayers = Array.isArray(result.players)
    ? result.players
    : [];

  const players =
    await enrichPlayersWithSessionTime(rawPlayers);

  const payload = {
    online: true,
    players,
    playerCount: players.length,
    maxPlayers: configuration.maxPlayers,
    namesAvailable: true,
    source: "battleye-rcon",
    rconDiagnostics:
      result.diagnostics || null,
    updatedAt: new Date().toISOString()
  };

  cachedPlayersPayload = payload;

  playersCacheExpiresAt =
    Date.now() + PLAYERS_CACHE_DURATION_MS;

  return payload;
}

router.get("/access", (req, res) => {
  res.set(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, private"
  );

  const sessionSecret =
    process.env.SESSION_SECRET;

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
    console.warn(
      `[COMMANDEMENT] Accès refusé pour SteamID ${steamId}`
    );

    return res.status(403).json({
      loggedIn: true,
      authorized: false,
      steamId: String(steamId),
      error:
        "Niveau d'autorisation insuffisant."
    });
  }

  return res.json({
    loggedIn: true,
    authorized: true,
    steamId: String(steamId),
    clearance: "ALPHA"
  });
});

router.get(
  "/votes",
  commandAuth,
  async (req, res) => {
    res.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, private"
    );

    try {
      const [ranking, topServeursStats, aliases, links] =
        await Promise.all([
          topServeursService.getPlayersRanking(),
          topServeursService.getStats(),
          voteAliasService.listAll(),
          supabaseService
            .request(
              "user_links?select=steam_id,discord_id,discord_username&limit=5000",
              { method: "GET" }
            )
            .catch(() => [])
        ]);

      const linkBySteamId = new Map(
        (Array.isArray(links) ? links : []).map(
          (row) => [
            String(row.steam_id || ""),
            row
          ]
        )
      );

      const aliasesByNormalized = new Map();
      const groups = new Map();

      for (const alias of aliases) {
        const normalized =
          voteAliasService.normalizeAlias(
            alias.alias
          );

        if (normalized) {
          aliasesByNormalized.set(
            normalized,
            alias
          );
        }

        if (!groups.has(alias.steamId)) {
          const link =
            linkBySteamId.get(
              alias.steamId
            ) || {};

          groups.set(alias.steamId, {
            steamId: alias.steamId,
            playerName:
              link.discord_username ||
              alias.alias ||
              alias.steamId,
            aliases: [],
            votes: 0,
            matchedNames: []
          });
        }

        groups
          .get(alias.steamId)
          .aliases.push(alias.alias);
      }

      const unidentified = [];

      for (const entry of ranking) {
        const alias =
          aliasesByNormalized.get(
            voteAliasService.normalizeAlias(
              entry.playerName
            )
          );

        if (!alias) {
          unidentified.push(entry);
          continue;
        }

        const group =
          groups.get(alias.steamId);

        group.votes += Number(
          entry.votes || 0
        );

        group.matchedNames.push(
          entry.playerName
        );
      }

      const identified = [
        ...groups.values()
      ]
        .filter(
          (group) => group.votes > 0
        )
        .sort(
          (a, b) =>
            b.votes - a.votes
        )
        .map((group, index) => ({
          ...group,
          position: index + 1
        }));

      const fullRanking = ranking
        .map((entry, index) => {
          const alias =
            aliasesByNormalized.get(
              voteAliasService.normalizeAlias(
                entry.playerName
              )
            );

          const group = alias
            ? groups.get(alias.steamId)
            : null;

          return {
            playerName: entry.playerName,
            votes: Number(
              entry.votes || 0
            ),
            position: Number(
              entry.position ||
                index + 1
            ),
            identified:
              Boolean(alias),
            steamId:
              alias?.steamId || null,
            memberName:
              group?.playerName || null
          };
        })
        .sort(
          (a, b) =>
            a.position -
              b.position ||
            b.votes - a.votes
        );

      return res.json({
        identified,

        unidentified:
          unidentified.sort(
            (a, b) =>
              b.votes - a.votes
          ),

        ranking: fullRanking,

        totals: {
          // Total réellement affiché par Top-Serveurs pour le mois courant.
          realVotes: Number(topServeursStats?.monthlyVotes || 0),

          // Somme des votes rattachés à un pseudo dans players-ranking.
          attributedVotes: ranking.reduce(
            (sum, entry) =>
              sum +
              Number(
                entry.votes || 0
              ),
            0
          ),

          // Conservé pour compatibilité avec les anciens écrans.
          votes: Number(topServeursStats?.monthlyVotes || 0),

          // Votes comptabilisés par Top-Serveurs mais absents du classement nominatif.
          unattributedVotes: Math.max(
            0,
            Number(topServeursStats?.monthlyVotes || 0) -
              ranking.reduce(
                (sum, entry) => sum + Number(entry.votes || 0),
                0
              )
          ),

          voteNames:
            ranking.length,

          identifiedPlayers:
            identified.length,

          unidentifiedNames:
            unidentified.length
        },

        members: (
          Array.isArray(links)
            ? links
            : []
        )
          .map((row) => ({
            steamId: String(
              row.steam_id || ""
            ),

            discordId:
              row.discord_id
                ? String(
                    row.discord_id
                  )
                : null,

            discordUsername:
              row.discord_username ||
              null
          }))
          .filter((row) =>
            /^\d{17}$/.test(
              row.steamId
            )
          )
          .sort((a, b) =>
            String(
              a.discordUsername ||
                a.steamId
            ).localeCompare(
              String(
                b.discordUsername ||
                  b.steamId
              ),
              "fr"
            )
          ),

        updatedAt:
          new Date().toISOString()
      });
    } catch (error) {
      console.error(
        "[COMMANDEMENT] Votes indisponibles :",
        error
      );

      return res
        .status(502)
        .json({
          error:
            error.message ||
            "Classement des votes indisponible."
        });
    }
  }
);

router.get(
  "/votes/history/:steamId",
  commandAuth,
  async (req, res) => {
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
    const steamId = String(req.params?.steamId || "").trim();
    if (!/^\d{17}$/.test(steamId)) return res.status(400).json({ error: "SteamID64 invalide." });
    try {
      const [operations, walletRows] = await Promise.all([
        voteWalletService.getHistory(steamId, 1000),
        supabaseService.request(`vote_wallets?steam_id=eq.${encodeURIComponent(steamId)}&select=steam_id,balance,lifetime_earned,lifetime_claimed,updated_at&limit=1`, { method: "GET" }).catch(() => [])
      ]);
      return res.json({ steamId, wallet: Array.isArray(walletRows) && walletRows.length ? walletRows[0] : null, operations });
    } catch (error) {
      console.error("[COMMANDEMENT] Historique cagnotte indisponible :", error);
      return res.status(500).json({ error: error.message || "Historique indisponible." });
    }
  }
);

router.post(
  "/votes/associate",
  commandAuth,
  async (req, res) => {
    res.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, private"
    );

    const steamId = String(
      req.body?.steamId || ""
    ).trim();

    const alias =
      voteAliasService.cleanAlias(
        req.body?.alias
      );

    if (!/^\d{17}$/.test(steamId)) {
      return res.status(400).json({
        error: "SteamID64 invalide."
      });
    }

    if (!alias) {
      return res.status(400).json({
        error:
          "Pseudo Top-Serveurs manquant."
      });
    }

    try {
      const [memberRows, ranking] =
        await Promise.all([
          supabaseService.request(
            `user_links?steam_id=eq.${encodeURIComponent(
              steamId
            )}&select=steam_id,discord_username&limit=1`,
            { method: "GET" }
          ),

          topServeursService.getPlayersRanking()
        ]);

      if (
        !Array.isArray(memberRows) ||
        memberRows.length === 0
      ) {
        return res.status(404).json({
          error:
            "Ce compte Senzany est introuvable."
        });
      }

      const normalizedAlias =
        voteAliasService.normalizeAlias(
          alias
        );

      const rankingEntry = (
        Array.isArray(ranking)
          ? ranking
          : []
      ).find(
        (entry) =>
          voteAliasService.normalizeAlias(
            entry.playerName
          ) === normalizedAlias
      );

      if (!rankingEntry) {
        return res.status(404).json({
          error:
            "Ce pseudo n’est plus présent dans le classement Top-Serveurs actuel."
        });
      }

      const created =
        await voteAliasService.addForSteamId(
          steamId,
          rankingEntry.playerName
        );

      return res.status(201).json({
        success: true,
        alias: created,

        member: {
          steamId,
          discordUsername:
            memberRows[0]
              .discord_username ||
            null
        }
      });
    } catch (error) {
      console.error(
        "[COMMANDEMENT] Association du pseudo impossible :",
        error
      );

      if (
        error.code ===
        "ALIAS_ALREADY_USED"
      ) {
        return res
          .status(409)
          .json({
            error: error.message
          });
      }

      if (
        error.code ===
        "ALIAS_LIMIT_REACHED"
      ) {
        return res
          .status(422)
          .json({
            error: error.message
          });
      }

      if (
        [
          "INVALID_ALIAS_LENGTH",
          "INVALID_ALIAS"
        ].includes(error.code)
      ) {
        return res
          .status(400)
          .json({
            error: error.message
          });
      }

      return res
        .status(500)
        .json({
          error:
            error.message ||
            "Association impossible."
        });
    }
  }
);

router.get(
  "/players",
  commandAuth,
  async (req, res) => {
    res.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, private"
    );

    if (
      cachedPlayersPayload &&
      Date.now() <
        playersCacheExpiresAt
    ) {
      return res.json({
        ...cachedPlayersPayload,
        source: "memory-cache"
      });
    }

    try {
      if (!playersQueryInFlight) {
        playersQueryInFlight =
          queryConnectedPlayers().finally(
            () => {
              playersQueryInFlight =
                null;
            }
          );
      }

      return res.json(
        await playersQueryInFlight
      );
    } catch (error) {
      const message =
        error?.message ||
        "Impossible d’interroger le serveur DayZ.";

      console.error(
        "[COMMANDEMENT] Liste des joueurs indisponible :",
        message
      );

      if (cachedPlayersPayload) {
        return res.json({
          ...cachedPlayersPayload,
          degraded: true,
          source:
            "stale-memory-cache",
          error: message,
          updatedAt:
            new Date().toISOString()
        });
      }

      return res
        .status(502)
        .json({
          online: false,
          players: [],
          playerCount: null,

          maxPlayers:
            getDayzConfiguration()
              .maxPlayers,

          namesAvailable: false,
          error: message,

          updatedAt:
            new Date().toISOString()
        });
    }
  }
);

router.get(
  "/players/:playerId/identity",
  commandAuth,
  async (req, res) => {
    res.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, private"
    );

    try {
      const player =
        await getCurrentPlayer(
          req.params.playerId
        );

      if (!player) {
        return res.status(404).json({
          error:
            "Ce joueur n’est plus connecté."
        });
      }

      const identity =
        await getPortalIdentityForPlayer(
          player
        );

      return res.json({
        ok: true,

        player: {
          id: player.id,
          name: player.name,
          guid: player.guid
        },

        identity:
          identity || {
            matched: false,
            ambiguous: false
          }
      });
    } catch (error) {
      console.error(
        "[COMMANDEMENT] Identité portail indisponible :",
        error?.message || error
      );

      return res
        .status(502)
        .json({
          error:
            "Impossible de vérifier la liaison Steam / Discord."
        });
    }
  }
);

router.get(
  "/players/linkable-members",
  commandAuth,
  async (req, res) => {
    res.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, private"
    );

    try {
      const search = String(req.query?.q || "")
        .trim()
        .toLocaleLowerCase("fr-FR");

      const rows = await supabaseService.request(
        "user_links?select=steam_id,discord_id,discord_username,discord_avatar,battleye_guid,created_at&order=discord_username.asc.nullslast&limit=1000",
        { method: "GET" }
      );

      const members = (Array.isArray(rows) ? rows : [])
        .filter((row) => {
          if (!search) return true;

          return [
            row.steam_id,
            row.discord_id,
            row.discord_username
          ]
            .map((value) =>
              String(value || "")
                .toLocaleLowerCase("fr-FR")
            )
            .some((value) => value.includes(search));
        })
        .slice(0, 40)
        .map((row) => ({
          steamId: String(row.steam_id || ""),
          discordId: row.discord_id
            ? String(row.discord_id)
            : null,
          discordUsername:
            row.discord_username || null,
          discordAvatar:
            row.discord_avatar || null,
          battleyeGuid:
            row.battleye_guid || null,
          alreadyLinked:
            Boolean(row.battleye_guid)
        }));

      return res.json({
        ok: true,
        members
      });
    } catch (error) {
      console.error(
        "[COMMANDEMENT] Liste des comptes Senzany indisponible :",
        error?.message || error
      );

      return res.status(502).json({
        error:
          "Impossible de charger les comptes Senzany."
      });
    }
  }
);

router.post(
  "/players/:playerId/identity/link",
  commandAuth,
  express.json(),
  async (req, res) => {
    res.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, private"
    );

    const steamId = String(
      req.body?.steamId || ""
    ).trim();

    if (!/^\d{17}$/.test(steamId)) {
      return res.status(400).json({
        error: "SteamID64 invalide."
      });
    }

    try {
      const player =
        await getCurrentPlayer(
          req.params.playerId
        );

      if (!player) {
        return res.status(404).json({
          error:
            "Ce joueur n’est plus connecté."
        });
      }

      const guid = String(
        player.guid || ""
      )
        .trim()
        .toLowerCase();

      if (!/^[a-f0-9]{32}$/.test(guid)) {
        return res.status(400).json({
          error:
            "Le GUID BattlEye du joueur est indisponible."
        });
      }

      const [memberRows, guidRows] =
        await Promise.all([
          supabaseService.request(
            `user_links?steam_id=eq.${encodeURIComponent(steamId)}&select=steam_id,discord_id,discord_username,discord_avatar,battleye_guid,created_at&limit=1`,
            { method: "GET" }
          ),
          supabaseService.request(
            `user_links?battleye_guid=eq.${encodeURIComponent(guid)}&select=steam_id,discord_username,battleye_guid&limit=2`,
            { method: "GET" }
          )
        ]);

      if (
        !Array.isArray(memberRows) ||
        memberRows.length === 0
      ) {
        return res.status(404).json({
          error:
            "Ce compte Senzany n’existe pas."
        });
      }

      const conflict = (
        Array.isArray(guidRows)
          ? guidRows
          : []
      ).find(
        (row) =>
          String(row.steam_id) !== steamId
      );

      if (conflict) {
        return res.status(409).json({
          error:
            `Ce GUID BattlEye est déjà relié au compte ${conflict.discord_username || conflict.steam_id}.`
        });
      }

      await supabaseService.request(
        `user_links?steam_id=eq.${encodeURIComponent(steamId)}`,
        {
          method: "PATCH",
          headers: {
            Prefer: "return=minimal"
          },
          body: JSON.stringify({
            battleye_guid: guid
          })
        }
      );

      const identity =
        portalIdentityFromLink(
          {
            ...memberRows[0],
            battleye_guid: guid
          },
          {
            matchMethod:
              "battleye-guid"
          }
        );

      console.warn(
        `[COMMANDEMENT] Liaison RCON par ${req.commandSteamId || "staff"} : ${player.name} (${guid}) -> ${steamId}`
      );

      return res.json({
        ok: true,
        player: {
          id: player.id,
          name: player.name,
          guid
        },
        identity
      });
    } catch (error) {
      console.error(
        "[COMMANDEMENT] Liaison GUID / compte Senzany échouée :",
        error?.message || error
      );

      return res.status(502).json({
        error:
          error?.message ||
          "Impossible d’enregistrer la liaison."
      });
    }
  }
);

router.post(
  "/players/:playerId/action",
  commandAuth,
  express.json(),
  async (req, res) => {
    res.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, private"
    );

    const action = String(
      req.body?.action || ""
    )
      .trim()
      .toLowerCase();

    const reason = String(
      req.body?.reason || ""
    )
      .replace(/[\r\n\0]/g, " ")
      .trim()
      .slice(0, 160);

    const minutes =
      Number.parseInt(
        req.body?.minutes,
        10
      );

    if (!reason) {
      return res.status(400).json({
        error:
          "Le motif est obligatoire."
      });
    }

    if (
      ![
        "kick",
        "tempban",
        "permban"
      ].includes(action)
    ) {
      return res.status(400).json({
        error: "Action inconnue."
      });
    }

    if (
      action === "tempban" &&
      (!Number.isInteger(minutes) ||
        minutes < 1 ||
        minutes > 525600)
    ) {
      return res.status(400).json({
        error:
          "Durée de bannissement invalide."
      });
    }

    try {
      const player =
        await getCurrentPlayer(
          req.params.playerId
        );

      if (!player) {
        return res.status(404).json({
          error:
            "Ce joueur n’est plus connecté."
        });
      }

      let command;

      if (action === "kick") {
        command =
          `kick ${player.id} ${reason}`;
      }

      if (action === "tempban") {
        command =
          `ban ${player.id} ${minutes} ${reason}`;
      }

      if (action === "permban") {
        command =
          `ban ${player.id} 0 ${reason}`;
      }

      const result =
        await rconService.executeAdminCommand(
          command
        );

      cachedPlayersPayload = null;
      playersCacheExpiresAt = 0;

      console.warn(
        `[COMMANDEMENT] ${action.toUpperCase()} par ${req.commandSteamId || "staff"} sur ${player.name} (${player.guid}) : ${reason}`
      );

      return res.json({
        ok: true,
        action,

        player: {
          id: player.id,
          name: player.name,
          guid: player.guid
        },

        response:
          result.rawResponse ||
          "Commande transmise."
      });
    } catch (error) {
      console.error(
        "[COMMANDEMENT] Action RCON échouée :",
        error?.message || error
      );

      return res
        .status(502)
        .json({
          error:
            error?.message ||
            "La commande RCON a échoué."
        });
    }
  }
);

module.exports = router;