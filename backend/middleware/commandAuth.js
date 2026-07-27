const { verifySteamId } = require("../utils/steamSession");
const { isCommandAuthorized } = require("../utils/commandAccess");

module.exports = function commandAuth(req, res, next) {
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
