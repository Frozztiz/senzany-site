const discordService = require("../services/discordService");
const supabaseService = require("../services/supabaseService");
const { verifySteamId } = require("../utils/steamSession");
const {
  createOAuthState,
  verifyOAuthState,
} = require("../utils/oauthState");

function getConfig() {
  return {
    siteUrl: String(process.env.SITE_URL || "").replace(/\/$/, ""),
    clientId: process.env.DISCORD_CLIENT_ID,
    clientSecret: process.env.DISCORD_CLIENT_SECRET,
    redirectUri: process.env.DISCORD_REDIRECT_URI,
    sessionSecret: process.env.SESSION_SECRET,
  };
}

function redirectToProfile(res, siteUrl, code) {
  return res.redirect(
    `${siteUrl}/senzany-profil.html?discord=${encodeURIComponent(code)}`
  );
}

exports.status = async (req, res) => {
  try {
    const result = await discordService.getStatus();
    res.json(result);
  } catch (error) {
    console.error("Discord status:", error);

    res.status(500).json({
      error: "Erreur Discord",
    });
  }
};

exports.stats = async (req, res) => {
  try {
    const result = await discordService.getStats();
    res.json(result);
  } catch (error) {
    console.error("Discord stats:", error);

    res.status(500).json({
      error: "Erreur Discord",
      message: error.message,
    });
  }
};

exports.login = (req, res) => {
  const {
    siteUrl,
    clientId,
    redirectUri,
    sessionSecret,
  } = getConfig();

  if (!siteUrl || !clientId || !redirectUri || !sessionSecret) {
    return res.status(500).send("Configuration Discord incomplète.");
  }

  const steamId = verifySteamId(
    req.cookies?.senzany_session,
    sessionSecret
  );

  if (!steamId) {
    return redirectToProfile(res, siteUrl, "steam_required");
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

  return res.redirect(
    `https://discord.com/oauth2/authorize?${params.toString()}`
  );
};

exports.callback = async (req, res) => {
  const {
    siteUrl,
    clientId,
    clientSecret,
    redirectUri,
    sessionSecret,
  } = getConfig();

  if (
    !siteUrl ||
    !clientId ||
    !clientSecret ||
    !redirectUri ||
    !sessionSecret
  ) {
    return res.status(500).send("Configuration serveur incomplète.");
  }

  const code = req.query.code;
  const stateValue = req.query.state;
  const oauthError = req.query.error;

  if (oauthError) {
    return redirectToProfile(res, siteUrl, "cancelled");
  }

  if (!code || !stateValue) {
    return redirectToProfile(res, siteUrl, "invalid_callback");
  }

  const state = verifyOAuthState(stateValue, sessionSecret);

  if (!state) {
    return redirectToProfile(res, siteUrl, "invalid_state");
  }

  const steamId = verifySteamId(
    req.cookies?.senzany_session,
    sessionSecret
  );

  if (!steamId || steamId !== state.steamId) {
    return redirectToProfile(res, siteUrl, "steam_required");
  }

  try {
    const tokenResponse = await fetch(
      "https://discord.com/api/v10/oauth2/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: "authorization_code",
          code,
          redirect_uri: redirectUri,
        }).toString(),
      }
    );

    if (!tokenResponse.ok) {
      console.error(
        "Discord token exchange:",
        tokenResponse.status,
        await tokenResponse.text()
      );

      return redirectToProfile(res, siteUrl, "token_error");
    }

    const token = await tokenResponse.json();

    const userResponse = await fetch(
      "https://discord.com/api/v10/users/@me",
      {
        headers: {
          Authorization: `Bearer ${token.access_token}`,
        },
      }
    );

    if (!userResponse.ok) {
      console.error(
        "Discord user fetch:",
        userResponse.status,
        await userResponse.text()
      );

      return redirectToProfile(res, siteUrl, "user_error");
    }

    const user = await userResponse.json();

    const displayName = user.global_name || user.username;

    const avatarUrl = user.avatar
      ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=256`
      : null;

    await supabaseService.upsertLink({
      steamId,
      discordId: user.id,
      discordUsername: displayName,
      discordAvatar: avatarUrl,
    });

    return redirectToProfile(res, siteUrl, "linked");
  } catch (error) {
    console.error(
      "Discord callback:",
      error.code || error.message,
      error.data || ""
    );

    if (error.code === "DISCORD_ALREADY_LINKED") {
      return redirectToProfile(res, siteUrl, "already_linked");
    }

    return redirectToProfile(res, siteUrl, "server_error");
  }
};

exports.unlink = async (req, res) => {
  const { sessionSecret } = getConfig();

  if (!sessionSecret) {
    return res.status(500).json({
      error: "Configuration serveur incomplète.",
    });
  }

  const steamId = verifySteamId(
    req.cookies?.senzany_session,
    sessionSecret
  );

  if (!steamId) {
    return res.status(401).json({
      error: "Connexion Steam requise.",
    });
  }

  try {
    await supabaseService.unlinkBySteamId(steamId);

    return res.json({
      ok: true,
    });
  } catch (error) {
    console.error(
      "Discord unlink:",
      error.message,
      error.data || ""
    );

    return res.status(502).json({
      error: "Impossible de dissocier Discord.",
    });
  }
};