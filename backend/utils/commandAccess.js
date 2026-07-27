const DEFAULT_COMMAND_STEAM_IDS = [
  "76561198072963309", // Toad — Owner
  "76561199273698198", // Twixie — Administrateur
  "76561198287646967", // Soon — Administrateur
  "76561197985997015"  // Frozzz — accès commandement
];

function getCommandSteamIds() {
  const configured = String(
    process.env.COMMAND_STEAM_IDS || process.env.STAFF_STEAM_IDS || ""
  )
    .split(",")
    .map((id) => id.trim())
    .filter((id) => /^\d{17}$/.test(id));

  return new Set(configured.length ? configured : DEFAULT_COMMAND_STEAM_IDS);
}

function isCommandAuthorized(steamId) {
  return /^\d{17}$/.test(String(steamId || "")) &&
    getCommandSteamIds().has(String(steamId));
}

module.exports = {
  getCommandSteamIds,
  isCommandAuthorized
};
