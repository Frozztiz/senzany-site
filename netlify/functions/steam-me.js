// Renvoie le profil Steam public du joueur connecté ainsi que son temps de jeu
// total sur DayZ lorsque les détails de jeux Steam sont visibles publiquement.

const crypto = require("crypto");
const { getLinkBySteamId } = require("./_supabase");

const DAYZ_APP_ID = 221100;

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
    body: JSON.stringify(body),
  };
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;

  header.split(";").forEach((part) => {
    const idx = part.indexOf("=");
    if (idx === -1) return;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    out[key] = value;
  });

  return out;
}

function verifySteamId(cookieValue, secret) {
  const [steamId, signature] = (cookieValue || "").split(".");
  if (!/^\d{17}$/.test(steamId || "") || !/^[a-f0-9]{64}$/i.test(signature || "")) {
    return null;
  }

  const expected = crypto.createHmac("sha256", secret).update(steamId).digest("hex");
  const supplied = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");

  if (supplied.length !== expectedBuffer.length) return null;
  return crypto.timingSafeEqual(supplied, expectedBuffer) ? steamId : null;
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Steam HTTP ${response.status}`);
  }

  return response.json();
}

async function getDayzPlaytime(apiKey, steamId) {
  const params = new URLSearchParams({
    key: apiKey,
    steamid: steamId,
    include_appinfo: "true",
    include_played_free_games: "true",
    format: "json",
  });
  params.append("appids_filter[0]", String(DAYZ_APP_ID));

  const url = `https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?${params.toString()}`;
  const data = await fetchJson(url);
  const games = data?.response?.games;

  // Steam peut retourner une réponse vide si les détails de jeux sont privés.
  if (!Array.isArray(games)) {
    return {
      available: false,
      reason: "private_or_unavailable",
      minutes: null,
      hours: null,
    };
  }

  const dayz = games.find((game) => Number(game.appid) === DAYZ_APP_ID);
  if (!dayz) {
    return {
      available: false,
      reason: "not_found",
      minutes: null,
      hours: null,
    };
  }

  const minutes = Number(dayz.playtime_forever || 0);
  return {
    available: true,
    reason: null,
    minutes,
    hours: Math.round((minutes / 60) * 10) / 10,
  };
}

exports.handler = async function handler(event) {
  const apiKey = process.env.STEAM_API_KEY;
  const sessionSecret = process.env.SESSION_SECRET;

  if (!apiKey || !sessionSecret) {
    return json(500, { error: "Configuration serveur manquante." });
  }

  const cookies = parseCookies(event.headers.cookie || event.headers.Cookie);
  const steamId = verifySteamId(cookies.senzany_session, sessionSecret);

  if (!steamId) {
    return json(200, { loggedIn: false });
  }

  try {
    const summaryUrl =
      "https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?" +
      new URLSearchParams({ key: apiKey, steamids: steamId }).toString();

    const [summaryData, dayzPlaytime, discordLink] = await Promise.all([
      fetchJson(summaryUrl),
      getDayzPlaytime(apiKey, steamId).catch(() => ({
        available: false,
        reason: "steam_error",
        minutes: null,
        hours: null,
      })),
      getLinkBySteamId(steamId).catch((error) => {
        console.error("Supabase profile lookup", error?.message || error);
        return null;
      }),
    ]);

    const player = summaryData?.response?.players?.[0];
    if (!player) {
      return json(200, { loggedIn: false });
    }

    return json(200, {
      loggedIn: true,
      steamId,
      name: player.personaname,
      avatar: player.avatarfull,
      profileUrl: player.profileurl,
      visibilityState: player.communityvisibilitystate,
      personaState: player.personastate,
      lastLogoff: player.lastlogoff || null,
      dayz: dayzPlaytime,
      discord: discordLink ? {
        linked: true,
        id: discordLink.discord_id,
        username: discordLink.discord_username,
        avatar: discordLink.discord_avatar,
        linkedAt: discordLink.created_at,
      } : { linked: false },
    });
  } catch (error) {
    console.error("steam-me error", error);
    return json(502, { error: "Impossible de contacter Steam." });
  }
};
