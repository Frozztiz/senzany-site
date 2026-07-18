const { parseCookies, verifySteamId, verifyOAuthState } = require("./_auth-utils");
const { upsertLink } = require("./_supabase");

function redirect(siteUrl, code) {
  return {
    statusCode: 302,
    headers: { Location: `${siteUrl}/senzany-profil.html?discord=${encodeURIComponent(code)}` },
    body: "",
  };
}

exports.handler = async function (event) {
  const siteUrl = (process.env.SITE_URL || "").replace(/\/$/, "");
  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  const redirectUri = process.env.DISCORD_REDIRECT_URI;
  const sessionSecret = process.env.SESSION_SECRET;

  if (!siteUrl || !clientId || !clientSecret || !redirectUri || !sessionSecret) {
    return { statusCode: 500, body: "Configuration serveur incomplète." };
  }

  const code = event.queryStringParameters?.code;
  const stateValue = event.queryStringParameters?.state;
  const oauthError = event.queryStringParameters?.error;
  if (oauthError) return redirect(siteUrl, "cancelled");
  if (!code || !stateValue) return redirect(siteUrl, "invalid_callback");

  const state = verifyOAuthState(stateValue, sessionSecret);
  if (!state) return redirect(siteUrl, "invalid_state");

  const cookies = parseCookies(event.headers.cookie || event.headers.Cookie);
  const steamId = verifySteamId(cookies.senzany_session, sessionSecret);
  if (!steamId || steamId !== state.steamId) return redirect(siteUrl, "steam_required");

  try {
    const tokenResponse = await fetch("https://discord.com/api/v10/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }).toString(),
    });
    if (!tokenResponse.ok) {
      console.error("Discord token exchange", tokenResponse.status, await tokenResponse.text());
      return redirect(siteUrl, "token_error");
    }
    const token = await tokenResponse.json();

    const userResponse = await fetch("https://discord.com/api/v10/users/@me", {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    if (!userResponse.ok) {
      console.error("Discord user fetch", userResponse.status, await userResponse.text());
      return redirect(siteUrl, "user_error");
    }
    const user = await userResponse.json();
    const displayName = user.global_name || user.username;
    const avatarUrl = user.avatar
      ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=256`
      : null;

    await upsertLink({
      steamId,
      discordId: user.id,
      discordUsername: displayName,
      discordAvatar: avatarUrl,
    });

    return redirect(siteUrl, "linked");
  } catch (error) {
    console.error("discord-callback error", error?.code || error?.message, error?.data || "");
    if (error?.code === "DISCORD_ALREADY_LINKED") return redirect(siteUrl, "already_linked");
    return redirect(siteUrl, "server_error");
  }
};
