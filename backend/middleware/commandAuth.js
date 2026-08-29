const { verifySteamId } = require("../utils/steamSession");
const { isCommandAuthorized } = require("../utils/commandAccess");

const LOCAL_DEV_ORIGINS = new Set([
  "http://localhost:8888",
  "http://127.0.0.1:8888",
]);

function isLoopbackAddress(value) {
  return ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(String(value || ""));
}

function isLocalDevRequest(req) {
  if (process.env.SENZANY_LOCAL_DEV !== "true") return false;

  const origin = String(req.headers.origin || "");
  const remoteAddress = req.socket?.remoteAddress;

  return LOCAL_DEV_ORIGINS.has(origin) && isLoopbackAddress(remoteAddress);
}

module.exports = function commandAuth(req, res, next) {
  // Aperçu local : lecture seule et uniquement depuis la machine locale.
  // SENZANY_LOCAL_DEV n'est jamais activé sur le serveur de production.
  if (isLocalDevRequest(req)) {
    if (req.method !== "GET") {
      return res.status(403).json({
        error: "Mode local en lecture seule : aucune modification n'a été envoyée.",
      });
    }

    req.commandSteamId = "LOCAL_DEV_READONLY";
    return next();
  }

  const sessionSecret = process.env.SESSION_SECRET;
  const steamId = sessionSecret
    ? verifySteamId(req.cookies?.senzany_session, sessionSecret)
    : null;

  if (!steamId) {
    return res.status(401).json({ error: "Connexion Steam requise." });
  }

  if (!isCommandAuthorized(steamId)) {
    console.warn(`[COMMANDEMENT] API refusée pour SteamID ${steamId}`);
    return res.status(403).json({ error: "Accès Commandement refusé." });
  }

  req.commandSteamId = String(steamId);
  next();
};
