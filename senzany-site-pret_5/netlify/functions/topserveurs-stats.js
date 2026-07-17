// Interroge l'API Top-Serveurs (token gardé secret côté serveur) pour
// récupérer les vraies statistiques du serveur : joueurs, votes, avis.

exports.handler = async function () {
  const token = process.env.TOP_SERVEURS_TOKEN;

  if (!token) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "TOP_SERVEURS_TOKEN manquant sur Netlify." }),
    };
  }

  try {
    const res = await fetch(`https://api.top-serveurs.net/v1/servers/${token}/full`);
    const data = await res.json();

    if (!res.ok || !data.success) {
      return {
        statusCode: 502,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Top-Serveurs a refusé la requête.", detail: data }),
      };
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=300",
      },
      body: JSON.stringify(data),
    };
  } catch (err) {
    return {
      statusCode: 502,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Impossible de contacter Top-Serveurs." }),
    };
  }
};
