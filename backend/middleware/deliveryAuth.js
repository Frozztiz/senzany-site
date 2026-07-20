const { verifySteamId } = require("../utils/steamSession");

/**
 * Lit et vérifie le cookie Steam déjà utilisé par le portail.
 */
function requireSteamSession(req, res, next) {
  const sessionSecret = process.env.SESSION_SECRET;

  if (!sessionSecret) {
    return res.status(500).json({
      success: false,
      error: "SESSION_SECRET est manquant sur le serveur.",
    });
  }

  const steamId = verifySteamId(
    req.cookies?.senzany_session,
    sessionSecret
  );

  if (!steamId) {
    return res.status(401).json({
      success: false,
      error: "Tu dois être connecté avec Steam.",
    });
  }

  req.steamId = steamId;
  next();
}

/**
 * Vérifie que le SteamID connecté appartient au staff autorisé.
 *
 * Exemple dans le fichier .env :
 * STAFF_STEAM_IDS=76561197985997015,76561198072963309
 */
function requireStaff(req, res, next) {
  const allowedSteamIds = String(
    process.env.STAFF_STEAM_IDS || ""
  )
    .split(",")
    .map((steamId) => steamId.trim())
    .filter(Boolean);

  if (allowedSteamIds.length === 0) {
    return res.status(503).json({
      success: false,
      error: "La liste des membres du staff n'est pas configurée.",
    });
  }

  if (!allowedSteamIds.includes(req.steamId)) {
    return res.status(403).json({
      success: false,
      error: "Cette fonctionnalité est réservée au staff.",
    });
  }

  next();
}

module.exports = {
  requireSteamSession,
  requireStaff,
};