const express = require("express");
const monthlyVoteRewardService = require("../services/monthlyVoteRewardService");

const router = express.Router();

function sendError(res, error) {
  console.error("[CLASSEMENT MENSUEL]", error?.data || error);
  res.status(error?.status || 500).json({
    error: error?.message || "Une erreur est survenue pendant le traitement mensuel des votes.",
  });
}

router.get("/status", async (req, res) => {
  try {
    res.json(await monthlyVoteRewardService.status());
  } catch (error) {
    sendError(res, error);
  }
});

router.get("/:runId", async (req, res) => {
  try {
    res.json(await monthlyVoteRewardService.detail(req.params.runId));
  } catch (error) {
    sendError(res, error);
  }
});

router.post("/prepare", async (req, res) => {
  try {
    const result = await monthlyVoteRewardService.prepare(req.body?.period, {
      force: Boolean(req.body?.force),
    });
    res.status(201).json(result);
  } catch (error) {
    sendError(res, error);
  }
});

router.post("/:runId/approve", async (req, res) => {
  try {
    res.json(await monthlyVoteRewardService.approve(req.params.runId, req.commandSteamId));
  } catch (error) {
    sendError(res, error);
  }
});

module.exports = router;
