const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

async function getStats() {
  const token = process.env.TOP_SERVEURS_TOKEN;

  if (!token) {
    throw new Error("TOP_SERVEURS_TOKEN manquant.");
  }

  const [fullRes, advicesRes] = await Promise.all([
    fetch(`https://api.top-serveurs.net/v1/servers/${token}/full`),
    fetch(`https://api.top-serveurs.net/v1/servers/${token}/advices`)
  ]);

  const fullData = await fullRes.json();
  const advicesData = await advicesRes.json();

  if (!fullRes.ok || !fullData.success) {
    throw new Error("Top-Serveurs a refusé la requête.");
  }

  const server = fullData.server;
  const currentMonthName = MONTHS[new Date().getMonth()];
  const monthlyStat = (server.last_monthly_stat && server.last_monthly_stat[0]) || {};

  return {
    monthlyVotes: monthlyStat[`${currentMonthName}_votes`] ?? 0,
    totalVotes: server.total_votes,
    totalClics: server.total_clics,
    advicesCount:
      advicesData.success && advicesData.advices
        ? advicesData.advices.length
        : null,
  };
}

module.exports = {
  getStats,
};