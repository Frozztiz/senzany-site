// Interroge l'API Top-Serveurs (token gardé secret côté serveur) pour
// récupérer les vraies statistiques du serveur : votes du mois et avis.

const MONTHS = ["january","february","march","april","may","june","july","august","september","october","november","december"];

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
    const [fullRes, advicesRes] = await Promise.all([
      fetch(`https://api.top-serveurs.net/v1/servers/${token}/full`),
      fetch(`https://api.top-serveurs.net/v1/servers/${token}/advices`),
    ]);

    const fullData = await fullRes.json();
    const advicesData = await advicesRes.json();

    if (!fullRes.ok || !fullData.success) {
      return {
        statusCode: 502,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Top-Serveurs a refusé la requête.", detail: fullData }),
      };
    }

    const server = fullData.server;
    const currentMonthName = MONTHS[new Date().getMonth()];
    const monthlyStat = (server.last_monthly_stat && server.last_monthly_stat[0]) || {};
    const monthlyVotes = monthlyStat[`${currentMonthName}_votes`] ?? 0;

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=300",
      },
      body: JSON.stringify({
        monthlyVotes,
        totalVotes: server.total_votes,
        totalClics: server.total_clics,
        avicesCount: (advicesData.success && advicesData.advices) ? advicesData.advices.length : null,
      }),
    };
  } catch (err) {
    return {
      statusCode: 502,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Impossible de contacter Top-Serveurs." }),
    };
  }
};
