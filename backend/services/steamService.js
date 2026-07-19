const supabaseService = require("./supabaseService");

const DAYZ_APP_ID = 221100;

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
}

function buildLoginUrl(siteUrl) {
  const params = new URLSearchParams({
    "openid.ns": "http://specs.openid.net/auth/2.0",
    "openid.mode": "checkid_setup",
    "openid.return_to": `${siteUrl}/api/steam/callback`,
    "openid.realm": siteUrl,
    "openid.identity":
      "http://specs.openid.net/auth/2.0/identifier_select",
    "openid.claimed_id":
      "http://specs.openid.net/auth/2.0/identifier_select",
  });

  return `https://steamcommunity.com/openid/login?${params.toString()}`;
}

async function verifyCallback(query) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query || {})) {
    if (Array.isArray(value)) {
      value.forEach((item) => params.append(key, item));
    } else if (value !== undefined && value !== null) {
      params.set(key, String(value));
    }
  }

  const verifyParams = new URLSearchParams(params);
  verifyParams.set("openid.mode", "check_authentication");

  const response = await fetch(
    "https://steamcommunity.com/openid/login",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: verifyParams.toString(),
    }
  );

  if (!response.ok) {
    throw new Error(`Steam OpenID HTTP ${response.status}`);
  }

  const text = await response.text();

  if (!text.includes("is_valid:true")) {
    return null;
  }

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

  const data = await fetchJson(
    `https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?${params}`
  );

  const games = data?.response?.games;

  if (!Array.isArray(games)) {
    return {
      available: false,
      reason: "private_or_unavailable",
      minutes: null,
      hours: null,
    };
  }

  const dayz = games.find(
    (game) => Number(game.appid) === DAYZ_APP_ID
  );

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

async function getDiscordMemberRoles(discordId) {
  const botToken = process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID;

  if (!botToken || !guildId || !discordId) {
    return {
      available: false,
      member: false,
      roles: [],
    };
  }

  const headers = {
    Authorization: `Bot ${botToken}`,
    Accept: "application/json",
  };

  const [memberResponse, rolesResponse] = await Promise.all([
    fetch(
      `https://discord.com/api/v10/guilds/${guildId}/members/${encodeURIComponent(
        discordId
      )}`,
      { headers }
    ),
    fetch(
      `https://discord.com/api/v10/guilds/${guildId}/roles`,
      { headers }
    ),
  ]);

  if (memberResponse.status === 404) {
    return {
      available: true,
      member: false,
      roles: [],
    };
  }

  if (!memberResponse.ok || !rolesResponse.ok) {
    throw new Error(
      `Discord HTTP member=${memberResponse.status} roles=${rolesResponse.status}`
    );
  }

  const member = await memberResponse.json();
  const guildRoles = await rolesResponse.json();

  const memberRoleIds = new Set(
    Array.isArray(member.roles) ? member.roles : []
  );

  const roles = (Array.isArray(guildRoles) ? guildRoles : [])
    .filter(
      (role) =>
        role.name !== "@everyone" &&
        memberRoleIds.has(role.id)
    )
    .sort(
      (a, b) =>
        Number(b.position || 0) - Number(a.position || 0)
    )
    .map((role) => ({
      id: role.id,
      name: role.name,
      color: Number(role.color || 0),
    }));

  return {
    available: true,
    member: true,
    nickname: member.nick || null,
    roles,
  };
}

async function getProfile(apiKey, steamId) {
  const params = new URLSearchParams({
    key: apiKey,
    steamids: steamId,
  });

  const [summaryData, dayz, discordLink] = await Promise.all([
    fetchJson(
      `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?${params}`
    ),

    getDayzPlaytime(apiKey, steamId).catch(() => ({
      available: false,
      reason: "steam_error",
      minutes: null,
      hours: null,
    })),

    supabaseService.getLinkBySteamId(steamId).catch((error) => {
      console.error(
        "Erreur lecture liaison Supabase :",
        error.message,
        error.data || ""
      );

      return null;
    }),
  ]);

  const player = summaryData?.response?.players?.[0];

  if (!player) {
    return null;
  }

  let discordGuild = null;

  if (discordLink?.discord_id) {
    discordGuild = await getDiscordMemberRoles(
      discordLink.discord_id
    ).catch((error) => {
      console.error(
        "Erreur récupération rôles Discord :",
        error.message
      );

      return {
        available: false,
        member: false,
        roles: [],
      };
    });
  }

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

    discord: discordLink
      ? {
          linked: true,
          id: discordLink.discord_id,
          username: discordLink.discord_username,
          avatar: discordLink.discord_avatar,
          linkedAt: discordLink.created_at,
          serverMember: discordGuild?.member === true,
          nickname: discordGuild?.nickname || null,
          rolesAvailable: discordGuild?.available === true,
          roles: Array.isArray(discordGuild?.roles)
            ? discordGuild.roles
            : [],
        }
      : {
          linked: false,
        },
  };
}

module.exports = {
  buildLoginUrl,
  verifyCallback,
  getProfile,
};