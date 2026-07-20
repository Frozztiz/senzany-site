const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

function getToken() {
  const token = process.env.TOP_SERVEURS_TOKEN;

  if (!token) {
    throw new Error("TOP_SERVEURS_TOKEN manquant.");
  }

  return token;
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Senzany-Portal/1.0",
    },
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error(`Top-Serveurs HTTP ${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

function normalizePlayerName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase()
    .trim();
}

function extractPlayers(data) {
  const possibleLists = [
    data?.players,
    data?.ranking,
    data?.playersRanking,
    data?.server?.players,
    data?.data?.players,
    data?.data?.ranking,
    Array.isArray(data) ? data : null,
  ];

  return possibleLists.find(Array.isArray) || [];
}

function mapPlayer(player, index) {
  return {
    id: player?.id ?? player?.player_id ?? null,

    playerName:
      player?.playername ??
      player?.playerName ??
      player?.username ??
      player?.name ??
      player?.pseudo ??
      "",

    votes: Number(
      player?.votes ??
      player?.vote_count ??
      player?.count ??
      0
    ),

    position: Number(
      player?.position ??
      player?.rank ??
      index + 1
    ),
  };
}

async function getStats() {
  const token = getToken();

  const [fullData, advicesData] = await Promise.all([
    fetchJson(
      `https://api.top-serveurs.net/v1/servers/${token}/full`
    ),

    fetchJson(
      `https://api.top-serveurs.net/v1/servers/${token}/advices`
    ),
  ]);

  if (!fullData?.success || !fullData?.server) {
    throw new Error("Top-Serveurs a refusé la requête.");
  }

  const server = fullData.server;
  const currentMonthName = MONTHS[new Date().getMonth()];

  const monthlyStat =
    (server.last_monthly_stat &&
      server.last_monthly_stat[0]) ||
    {};

  return {
    monthlyVotes:
      monthlyStat[`${currentMonthName}_votes`] ?? 0,

    totalVotes: server.total_votes,
    totalClics: server.total_clics,

    advicesCount:
      advicesData?.success && advicesData?.advices
        ? advicesData.advices.length
        : null,
  };
}

async function getPlayersRanking() {
  const token = getToken();

  const data = await fetchJson(
    `https://api.top-serveurs.net/v1/servers/${token}/players-ranking`
  );

  return extractPlayers(data)
    .map(mapPlayer)
    .filter(
      (player) =>
        player.playerName &&
        Number.isFinite(player.votes)
    );
}

async function getDiscordNames(discordId, storedUsername) {
  const names = new Set();

  if (storedUsername) {
    names.add(String(storedUsername).trim());
  }

  const botToken = process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID;

  if (!botToken || !guildId || !discordId) {
    return [...names];
  }

  try {
    const response = await fetch(
      `https://discord.com/api/v10/guilds/${guildId}/members/${encodeURIComponent(
        discordId
      )}`,
      {
        headers: {
          Authorization: `Bot ${botToken}`,
          Accept: "application/json",
        },
      }
    );

    if (!response.ok) {
      console.warn(
        `Discord member HTTP ${response.status}`
      );

      return [...names];
    }

    const member = await response.json();

    [
      member?.nick,
      member?.user?.global_name,
      member?.user?.username,
    ].forEach((name) => {
      if (name) {
        names.add(String(name).trim());
      }
    });
  } catch (error) {
    console.warn(
      "Noms Discord indisponibles :",
      error.message
    );
  }

  return [...names];
}

async function getPlayerVotes({
  discordId,
  discordUsername,
}) {
  /*
   * On récupère d’abord le classement.
   * On récupère ensuite les noms Discord.
   *
   * Cela évite que l’appel Discord et l’appel Top-Serveurs
   * se perturbent ou échouent simultanément.
   */
  const ranking = await getPlayersRanking();

  const discordNames = await getDiscordNames(
    discordId,
    discordUsername
  );

  const normalizedCandidates = [
    ...new Set(
      discordNames
        .map(normalizePlayerName)
        .filter(Boolean)
    ),
  ];

  const player = ranking.find((entry) => {
    const normalizedPlayerName =
      normalizePlayerName(entry.playerName);

    return normalizedCandidates.includes(
      normalizedPlayerName
    );
  });

  /*
   * Diagnostic temporaire :
   * permet de voir ce que l’API a réellement reçu.
   */
  const closeMatches = ranking
    .filter((entry) => {
      const normalizedName =
        normalizePlayerName(entry.playerName);

      return normalizedCandidates.some(
        (candidate) =>
          normalizedName.includes(candidate) ||
          candidate.includes(normalizedName)
      );
    })
    .slice(0, 10)
    .map((entry) => ({
      playerName: entry.playerName,
      normalizedName: normalizePlayerName(
        entry.playerName
      ),
      votes: entry.votes,
      position: entry.position,
    }));

  return {
    linked: true,
    found: Boolean(player),

    votes: player?.votes ?? 0,
    position: player?.position ?? null,
    matchedName: player?.playerName ?? null,

    checkedNames: discordNames,

    debug: {
      rankingCount: ranking.length,
      normalizedCandidates,
      closeMatches,
    },
  };
}

module.exports = {
  getStats,
  getPlayersRanking,
  getPlayerVotes,
};