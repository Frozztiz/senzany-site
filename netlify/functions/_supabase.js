function config() {
  const url = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL ou SUPABASE_SECRET_KEY manquante");
  return { url, key };
}

async function request(path, options = {}) {
  const { url, key } = config();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) {
    const err = new Error(`Supabase HTTP ${response.status}`);
    err.status = response.status;
    err.data = data;
    throw err;
  }
  return data;
}

async function getLinkBySteamId(steamId) {
  const q = `user_links?steam_id=eq.${encodeURIComponent(steamId)}&select=id,steam_id,discord_id,discord_username,discord_avatar,created_at&limit=1`;
  const rows = await request(q, { method: "GET" });
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

async function getLinkByDiscordId(discordId) {
  const q = `user_links?discord_id=eq.${encodeURIComponent(discordId)}&select=id,steam_id,discord_id,discord_username,discord_avatar,created_at&limit=1`;
  const rows = await request(q, { method: "GET" });
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

async function upsertLink({ steamId, discordId, discordUsername, discordAvatar }) {
  const existingSteam = await getLinkBySteamId(steamId);
  const existingDiscord = await getLinkByDiscordId(discordId);

  if (existingDiscord && existingDiscord.steam_id !== steamId) {
    const err = new Error("Discord already linked");
    err.code = "DISCORD_ALREADY_LINKED";
    throw err;
  }

  const payload = {
    steam_id: steamId,
    discord_id: discordId,
    discord_username: discordUsername,
    discord_avatar: discordAvatar,
  };

  if (existingSteam) {
    const rows = await request(`user_links?steam_id=eq.${encodeURIComponent(steamId)}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(payload),
    });
    return Array.isArray(rows) ? rows[0] : rows;
  }

  const rows = await request("user_links", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    // La table actuelle utilise un bigint comme clé primaire sans auto-incrément.
    // Le SteamID64 est unique et tient dans bigint côté PostgreSQL ; on l'utilise
    // donc aussi comme clé technique, envoyé sous forme de chaîne pour éviter
    // toute perte de précision JavaScript.
    body: JSON.stringify({ id: steamId, ...payload }),
  });
  return Array.isArray(rows) ? rows[0] : rows;
}

async function unlinkBySteamId(steamId) {
  await request(`user_links?steam_id=eq.${encodeURIComponent(steamId)}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" },
  });
}

module.exports = { getLinkBySteamId, getLinkByDiscordId, upsertLink, unlinkBySteamId };
