function getConfig() {
  const url = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const key = process.env.SUPABASE_SECRET_KEY;

  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL ou SUPABASE_SECRET_KEY manquante dans le backend."
    );
  }

  return { url, key };
}

async function request(path, options = {}) {
  const { url, key } = getConfig();

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

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    const error = new Error(`Supabase HTTP ${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

async function getLinkBySteamId(steamId) {
  const query =
    `user_links` +
    `?steam_id=eq.${encodeURIComponent(steamId)}` +
    `&select=id,steam_id,discord_id,discord_username,discord_avatar,created_at` +
    `&limit=1`;

  const rows = await request(query, {
    method: "GET",
  });

  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

async function getLinkByDiscordId(discordId) {
  const query =
    `user_links` +
    `?discord_id=eq.${encodeURIComponent(discordId)}` +
    `&select=id,steam_id,discord_id,discord_username,discord_avatar,created_at` +
    `&limit=1`;

  const rows = await request(query, {
    method: "GET",
  });

  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

async function upsertLink({
  steamId,
  discordId,
  discordUsername,
  discordAvatar,
}) {
  const existingSteamLink = await getLinkBySteamId(steamId);
  const existingDiscordLink = await getLinkByDiscordId(discordId);

  if (
    existingDiscordLink &&
    existingDiscordLink.steam_id !== steamId
  ) {
    const error = new Error(
      "Ce compte Discord est déjà lié à un autre compte Steam."
    );

    error.code = "DISCORD_ALREADY_LINKED";
    throw error;
  }

  const payload = {
    steam_id: steamId,
    discord_id: discordId,
    discord_username: discordUsername,
    discord_avatar: discordAvatar,
  };

  if (existingSteamLink) {
    const rows = await request(
      `user_links?steam_id=eq.${encodeURIComponent(steamId)}`,
      {
        method: "PATCH",
        headers: {
          Prefer: "return=representation",
        },
        body: JSON.stringify(payload),
      }
    );

    return Array.isArray(rows) ? rows[0] : rows;
  }

  const rows = await request("user_links", {
    method: "POST",
    headers: {
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      id: steamId,
      ...payload,
    }),
  });

  return Array.isArray(rows) ? rows[0] : rows;
}

async function unlinkBySteamId(steamId) {
  await request(
    `user_links?steam_id=eq.${encodeURIComponent(steamId)}`,
    {
      method: "DELETE",
      headers: {
        Prefer: "return=minimal",
      },
    }
  );
}

module.exports = {
  getLinkBySteamId,
  getLinkByDiscordId,
  upsertLink,
  unlinkBySteamId,
};