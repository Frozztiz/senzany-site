const express = require("express");
const router = express.Router();
const monthlyVoteRewardService = require("../services/monthlyVoteRewardService");
const monthlyRankingRewardService = require("../services/monthlyRankingRewardService");

function fail(res, error) {
  console.error("[MONTHLY VOTES]", error?.data || error);
  res.status(error?.status || 500).json({
    error: error?.message || "Erreur lors de la gestion des récompenses mensuelles.",
  });
}

// Flux historique existant (paliers / snapshot mensuel) — conservé tel quel.
router.get("/status", async (req, res) => {
  try {
    res.json(await monthlyVoteRewardService.status());
  } catch (error) {
    fail(res, error);
  }
});

// Nouveau flux séparé : récompenses du classement Top 10 (votes_ranking).
router.get("/ranking-rewards/:period/preview", async (req, res) => {
  try {
    res.json(await monthlyRankingRewardService.preview(req.params.period));
  } catch (error) {
    fail(res, error);
  }
});

router.post("/ranking-rewards/:period/approve", async (req, res) => {
  try {
    res.json(await monthlyRankingRewardService.approve(req.params.period, req.commandSteamId));
  } catch (error) {
    fail(res, error);
  }
});

router.get("/:runId", async (req, res) => {
  try {
    res.json(await monthlyVoteRewardService.detail(req.params.runId));
  } catch (error) {
    fail(res, error);
  }
});

router.post("/prepare", async (req, res) => {
  try {
    const result = await monthlyVoteRewardService.prepare(req.body?.period, {
      force: req.body?.force === true,
    });
    res.status(201).json(result);
  } catch (error) {
    fail(res, error);
  }
});

router.post("/:runId/approve", async (req, res) => {
  try {
    res.json(await monthlyVoteRewardService.approve(req.params.runId, req.commandSteamId));
  } catch (error) {
    fail(res, error);
  }
});

module.exports = router;
