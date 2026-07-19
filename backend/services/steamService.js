const DAYZ_APP_ID = 221100;

async function fetchJson(url) {
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Steam HTTP ${response.status}`);
  return response.json();
}

function buildLoginUrl(siteUrl) {
  const params = new URLSearchParams({
    "openid.ns": "http://specs.openid.net/auth/2.0",
    "openid.mode": "checkid_setup",
    "openid.return_to": `${siteUrl}/api/steam/callback`,
    "openid.realm": siteUrl,
    "openid.identity": "http://specs.openid.net/auth/2.0/identifier_select",
    "openid.claimed_id": "http://specs.openid.net/auth/2.0/identifier_select",
  });
  return `https://steamcommunity.com/openid/login?${params.toString()}`;
}

async function verifyCallback(query) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query || {})) {
    if (Array.isArray(value)) value.forEach((item) => params.append(key, item));
    else if (value !== undefined && value !== null) params.set(key, String(value));
  }

  const verifyParams = new URLSearchParams(params);
  verifyParams.set("openid.mode", "check_authentication");

  const response = await fetch("https://steamcommunity.com/openid/login", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: verifyParams.toString(),
  });

  if (!response.ok) throw new Error(`Steam OpenID HTTP ${response.status}`);
  const text = await response.text();
  if (!text.includes("is_valid:true")) return null;

  const claimedId = params.get("openid.claimed_id") || "";
  return claimedId.match(/\/id\/(\d+)$/)?.[1] || null;
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

  const data = await fetchJson(`https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?${params}`);
  const games = data?.response?.games;
  if (!Array.isArray(games)) return { available: false, reason: "private_or_unavailable", minutes: null, hours: null };

  const dayz = games.find((game) => Number(game.appid) === DAYZ_APP_ID);
  if (!dayz) return { available: false, reason: "not_found", minutes: null, hours: null };

  const minutes = Number(dayz.playtime_forever || 0);
  return { available: true, reason: null, minutes, hours: Math.round((minutes / 60) * 10) / 10 };
}

async function getProfile(apiKey, steamId) {
  const params = new URLSearchParams({ key: apiKey, steamids: steamId });
  const [summaryData, dayz] = await Promise.all([
    fetchJson(`https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?${params}`),
    getDayzPlaytime(apiKey, steamId).catch(() => ({ available: false, reason: "steam_error", minutes: null, hours: null })),
  ]);

  const player = summaryData?.response?.players?.[0];
  if (!player) return null;

  return {
    loggedIn: true,
    steamId,
    name: player.personaname,
    avatar: player.avatarfull,
    profileUrl: player.profileurl,
    visibilityState: player.communityvisibilitystate,
    personaState: player.personastate,
    lastLogoff: player.lastlogoff || null,
    dayz,
    discord: { linked: false },
  };
}

module.exports = { buildLoginUrl, verifyCallback, getProfile };
