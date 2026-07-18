const express = require("express");
const router = express.Router();

const MONTHS = [
  "january", "february", "march", "april",
  "may", "june", "july", "august",
  "september", "october", "november", "december"
];

router.get("/stats", async (req, res) => {
  const token = process.env.TOP_SERVEURS_TOKEN;

  if (!token) {
    return res.status(500).json({ error: "TOP_SERVEURS_TOKEN manquant sur OVH." });
  }

  try {
    const [fullRes, advicesRes] = await Promise.all([
      fetch(`https://api.top-serveurs.net/v1/servers/${token}/full`),
      fetch(`https://api.top-serveurs.net/v1/servers/${token}/advices`)
    ]);

    const fullData = await fullRes.json();
    const advicesData = await advicesRes.json();

    if (!fullRes.ok || !fullData.success) {
      return res.status(502).json({
        error: "Top-Serveurs a refusé la requête.",
        detail: fullData
      });
    }

    const server = fullData.server;
    const currentMonthName = MONTHS[new Date().getMonth()];
    const monthlyStat =
      (server.last_monthly_stat && server.last_monthly_stat[0]) || {};

    return res.json({
      monthlyVotes: monthlyStat[`${currentMonthName}_votes`] ?? 0,
      totalVotes: server.total_votes,
      totalClics: server.total_clics,
      advicesCount:
        advicesData.success && advicesData.advices
          ? advicesData.advices.length
          : null
    });
  } catch (error) {
    console.error("Erreur Top-Serveurs :", error);
    return res.status(502).json({ error: "Impossible de contacter Top-Serveurs." });
  }
});

module.exports = router;
