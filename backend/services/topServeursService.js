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
  if (!token) throw new Error("TOP_SERVEURS_TOKEN manquant.");
  return token;
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
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
    .toLowerCase();
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
    votes: Number(player?.votes ?? player?.vote_count ?? player?.count ?? 0),
    position: Number(player?.position ?? player?.rank ?? index + 1),
  };
}

async function getStats() {
  const token = getToken();

  const [fullData, advicesData] = await Promise.all([
    fetchJson(`https://api.top-serveurs.net/v1/servers/${token}/full`),
    fetchJson(`https://api.top-serveurs.net/v1/servers/${token}/advices`),
  ]);

  if (!fullData?.success || !fullData?.server) {
    throw new Error("Top-Serveurs a refusé la requête.");
  }

  const server = fullData.server;
  const currentMonthName = MONTHS[new Date().getMonth()];
  const monthlyStat = (server.last_monthly_stat && server.last_monthly_stat[0]) || {};

  return {
    monthlyVotes: monthlyStat[`${currentMonthName}_votes`] ?? 0,
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
    .filter((player) => player.playerName && Number.isFinite(player.votes));
}

async function getDiscordNames(discordId, storedUsername) {
  const names = new Set();
  if (storedUsername) names.add(storedUsername);

  const botToken = process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID;
  if (!botToken || !guildId || !discordId) return [...names];

  try {
    const response = await fetch(
      `https://discord.com/api/v10/guilds/${guildId}/members/${encodeURIComponent(discordId)}`,
      { headers: { Authorization: `Bot ${botToken}` } }
    );

    if (!response.ok) return [...names];
    const member = await response.json();
    [
      member?.nick,
      member?.user?.global_name,
      member?.user?.username,
    ].forEach((name) => {
      if (name) names.add(name);
    });
  } catch (error) {
    console.warn("Discord names indisponibles pour le classement:", error.message);
  }

  return [...names];
}

async function getPlayerVotes({ aliases = [] }) {
  const ranking = await getPlayersRanking();
  const checkedNames = [...new Set(aliases.map((name) => String(name || "").trim()).filter(Boolean))];

  const rankingByNormalizedName = new Map();
  ranking.forEach((entry) => {
    const normalizedName = normalizePlayerName(entry.playerName);
    if (!normalizedName) return;

    const existing = rankingByNormalizedName.get(normalizedName);
    if (!existing) {
      rankingByNormalizedName.set(normalizedName, { ...entry });
      return;
    }

    existing.votes += Number(entry.votes || 0);
    const currentPosition = Number(existing.position);
    const newPosition = Number(entry.position);
    if (Number.isFinite(newPosition) && (!Number.isFinite(currentPosition) || newPosition < currentPosition)) {
      existing.position = newPosition;
    }
  });

  const aliasDetails = checkedNames.map((alias) => {
    const match = rankingByNormalizedName.get(normalizePlayerName(alias));
    return {
      alias,
      found: Boolean(match),
      matchedName: match?.playerName || null,
      votes: Number(match?.votes || 0),
      position: Number.isFinite(Number(match?.position)) ? Number(match.position) : null,
    };
  });

  const matchedAliases = aliasDetails.filter((entry) => entry.found);
  const votes = matchedAliases.reduce((total, entry) => total + entry.votes, 0);
  const bestPosition = matchedAliases.reduce((best, entry) => {
    if (!Number.isFinite(entry.position)) return best;
    return best === null || entry.position < best ? entry.position : best;
  }, null);

  return {
    found: matchedAliases.length > 0,
    votes,
    position: bestPosition,
    matchedNames: matchedAliases.map((entry) => entry.matchedName),
    checkedNames,
    aliasDetails,
  };
}

module.exports = {
  getStats,
  getPlayersRanking,
  getPlayerVotes,
};
