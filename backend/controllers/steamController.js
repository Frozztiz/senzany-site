const steamService = require("../services/steamService");

const {
  signSteamId,
  verifySteamId
} = require("../utils/steamSession");

function config() {
  return {
    siteUrl: String(process.env.SITE_URL || "").replace(/\/$/, ""),
    apiKey: process.env.STEAM_API_KEY,
    sessionSecret: process.env.SESSION_SECRET
  };
}

function cookieOptions(siteUrl) {
  return {
    httpOnly: true,
    secure: siteUrl.startsWith("https://"),
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60 * 1000
  };
}

exports.login = (req, res) => {
  const { siteUrl } = config();

  if (!siteUrl) {
    return res.status(500).send("SITE_URL manquante.");
  }

  return res.redirect(
    steamService.buildLoginUrl(siteUrl)
  );
};

exports.callback = async (req, res) => {
  const {
    siteUrl,
    sessionSecret
  } = config();

  if (!siteUrl || !sessionSecret) {
    return res
      .status(500)
      .send("Configuration Steam incomplète.");
  }

  try {
    const steamId = await steamService.verifyCallback(
      req.query
    );

    if (!steamId) {
      return res
        .status(401)
        .send("Connexion Steam invalide ou expirée.");
    }

    res.cookie(
      "senzany_session",
      signSteamId(steamId, sessionSecret),
      cookieOptions(siteUrl)
    );

    return res.redirect(
      `${siteUrl}/senzany-profil.html`
    );
  } catch (error) {
    console.error("Steam callback :", error);

    return res
      .status(502)
      .send("Impossible de vérifier la connexion Steam.");
  }
};

exports.me = async (req, res) => {
  const {
    apiKey,
    sessionSecret
  } = config();

  res.set("Cache-Control", "no-store");

  if (!apiKey || !sessionSecret) {
    return res.status(500).json({
      error: "Configuration Steam manquante."
    });
  }

  const steamId = verifySteamId(
    req.cookies?.senzany_session,
    sessionSecret
  );

  if (!steamId) {
    return res.json({
      loggedIn: false
    });
  }

  try {
    const profile = await steamService.getProfile(
      apiKey,
      steamId
    );

    const staffSteamIds = String(
      process.env.STAFF_STEAM_IDS || ""
    )
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);

    const isStaff = staffSteamIds.includes(
      String(steamId)
    );

    return res.json({
      ...(profile || {}),
      loggedIn: true,
      steamId: String(steamId),
      isStaff
    });
  } catch (error) {
    console.error("Steam profile :", error);

    return res.status(502).json({
      error: "Steam indisponible."
    });
  }
};

exports.logout = (req, res) => {
  const { siteUrl } = config();

  res.clearCookie("senzany_session", {
    httpOnly: true,
    secure: siteUrl.startsWith("https://"),
    sameSite: "lax",
    path: "/"
  });

  return res.redirect(
    `${siteUrl || ""}/senzany-profil.html`
  );
};