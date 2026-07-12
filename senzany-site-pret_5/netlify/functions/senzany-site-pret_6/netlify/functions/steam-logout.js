// Supprime le cookie de session pour déconnecter le joueur.

exports.handler = async function (event) {
  const siteUrl = process.env.SITE_URL || "/";
  return {
    statusCode: 302,
    headers: {
      Location: `${siteUrl}/senzany-profil.html`,
      "Set-Cookie": "senzany_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0",
    },
    body: "",
  };
};
