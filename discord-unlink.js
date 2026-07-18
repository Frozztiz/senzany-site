const { parseCookies, verifySteamId, json } = require("./_auth-utils");
const { unlinkBySteamId } = require("./_supabase");

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") return json(405, { error: "Méthode non autorisée" });
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) return json(500, { error: "Configuration serveur incomplète" });

  const cookies = parseCookies(event.headers.cookie || event.headers.Cookie);
  const steamId = verifySteamId(cookies.senzany_session, sessionSecret);
  if (!steamId) return json(401, { error: "Connexion Steam requise" });

  try {
    await unlinkBySteamId(steamId);
    return json(200, { ok: true });
  } catch (error) {
    console.error("discord-unlink error", error?.message, error?.data || "");
    return json(502, { error: "Impossible de dissocier Discord" });
  }
};
