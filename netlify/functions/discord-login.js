const { parseCookies, verifySteamId, createOAuthState } = require("./_auth-utils");

exports.handler = async function (event) {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const redirectUri = process.env.DISCORD_REDIRECT_URI;
  const sessionSecret = process.env.SESSION_SECRET;
  if (!clientId || !redirectUri || !sessionSecret) {
    return { statusCode: 500, body: "Configuration Discord incomplète." };
  }

  const cookies = parseCookies(event.headers.cookie || event.headers.Cookie);
  const steamId = verifySteamId(cookies.senzany_session, sessionSecret);
  if (!steamId) {
    return { statusCode: 302, headers: { Location: "/senzany-profil.html?discord=steam_required" }, body: "" };
  }

  const state = createOAuthState(steamId, sessionSecret);
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: "identify",
    state,
    prompt: "consent",
  });

  return {
    statusCode: 302,
    headers: {
      Location: `https://discord.com/oauth2/authorize?${params.toString()}`,
      "Cache-Control": "no-store",
    },
    body: "",
  };
};
