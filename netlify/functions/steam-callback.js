// Reçoit la réponse de Steam après connexion, vérifie qu'elle est authentique
// auprès de Steam, récupère le profil du joueur, et pose un cookie de session
// signé (pas de base de données nécessaire pour cette première étape).

const crypto = require("crypto");

function signSteamId(steamId, secret) {
  const signature = crypto.createHmac("sha256", secret).update(steamId).digest("hex");
  return `${steamId}.${signature}`;
}

exports.handler = async function (event) {
  const siteUrl = process.env.SITE_URL;
  const apiKey = process.env.STEAM_API_KEY;
  const sessionSecret = process.env.SESSION_SECRET;

  if (!siteUrl || !apiKey || !sessionSecret) {
    return {
      statusCode: 500,
      body: "Variables d'environnement manquantes (SITE_URL, STEAM_API_KEY, SESSION_SECRET) — a configurer dans Netlify > Site settings > Environment variables.",
    };
  }

  const params = new URLSearchParams(event.queryStringParameters);

  // On repasse tous les paramètres reçus à Steam pour qu'il confirme
  // que cette réponse de connexion est bien authentique.
  const verifyParams = new URLSearchParams(params);
  verifyParams.set("openid.mode", "check_authentication");

  let verifyText;
  try {
    const verifyRes = await fetch("https://steamcommunity.com/openid/login", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: verifyParams.toString(),
    });
    verifyText = await verifyRes.text();
  } catch (err) {
    return { statusCode: 502, body: "Impossible de contacter Steam pour vérifier la connexion." };
  }

  if (!verifyText.includes("is_valid:true")) {
    return { statusCode: 401, body: "Connexion Steam invalide ou expirée. Réessayez." };
  }

  const claimedId = params.get("openid.claimed_id") || "";
  const match = claimedId.match(/\/id\/(\d+)$/);
  if (!match) {
    return { statusCode: 400, body: "Identifiant Steam introuvable dans la réponse." };
  }
  const steamId = match[1];

  const cookieValue = signSteamId(steamId, sessionSecret);

  return {
    statusCode: 302,
    headers: {
      Location: `${siteUrl}/senzany-profil.html`,
      "Set-Cookie": `senzany_session=${cookieValue}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`,
    },
    body: "",
  };
};
