// Lit le cookie de session, vérifie sa signature, et renvoie le profil
// Steam public du joueur connecté (pseudo, avatar).

const crypto = require("crypto");

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  header.split(";").forEach((part) => {
    const idx = part.indexOf("=");
    if (idx === -1) return;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    out[key] = val;
  });
  return out;
}

function verifySteamId(cookieValue, secret) {
  const [steamId, signature] = (cookieValue || "").split(".");
  if (!steamId || !signature) return null;
  const expected = crypto.createHmac("sha256", secret).update(steamId).digest("hex");
  const isValid =
    signature.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  return isValid ? steamId : null;
}

exports.handler = async function (event) {
  const apiKey = process.env.STEAM_API_KEY;
  const sessionSecret = process.env.SESSION_SECRET;

  if (!apiKey || !sessionSecret) {
    return { statusCode: 500, body: JSON.stringify({ error: "Configuration serveur manquante." }) };
  }

  const cookies = parseCookies(event.headers.cookie);
  const steamId = verifySteamId(cookies.senzany_session, sessionSecret);

  if (!steamId) {
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ loggedIn: false }),
    };
  }

  try {
    const res = await fetch(
      `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${apiKey}&steamids=${steamId}`
    );
    const data = await res.json();
    const player = data.response.players[0];

    if (!player) {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loggedIn: false }),
      };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        loggedIn: true,
        steamId,
        name: player.personaname,
        avatar: player.avatarfull,
        profileUrl: player.profileurl,
      }),
    };
  } catch (err) {
    return { statusCode: 502, body: JSON.stringify({ error: "Impossible de contacter Steam." }) };
  }
};
