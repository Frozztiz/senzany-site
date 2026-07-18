// Démarre le flux de connexion Steam (OpenID 2.0).
// Redirige l'utilisateur vers la page de connexion officielle de Steam.

exports.handler = async function (event) {
  const siteUrl = process.env.SITE_URL;

  if (!siteUrl) {
    return {
      statusCode: 500,
      body: "Variable d'environnement SITE_URL manquante sur Netlify (Site settings > Environment variables).",
    };
  }

  const returnTo = `${siteUrl}/api/steam/callback`;
  const realm = siteUrl;

  const params = new URLSearchParams({
    "openid.ns": "http://specs.openid.net/auth/2.0",
    "openid.mode": "checkid_setup",
    "openid.return_to": returnTo,
    "openid.realm": realm,
    "openid.identity": "http://specs.openid.net/auth/2.0/identifier_select",
    "openid.claimed_id": "http://specs.openid.net/auth/2.0/identifier_select",
  });

  return {
    statusCode: 302,
    headers: {
      Location: `https://steamcommunity.com/openid/login?${params.toString()}`,
    },
    body: "",
  };
};
