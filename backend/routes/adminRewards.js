const express = require("express");
const rewardRuleService = require("../services/rewardRuleService");

const router = express.Router();

function sendError(res, error) {
  console.error("[RÉCOMPENSES]", error?.data || error);
  res.status(error?.status || 500).json({
    error: error?.message || "Une erreur est survenue dans le module Récompenses.",
  });
}

router.get("/", async (req, res) => {
  try {
    const rules = await rewardRuleService.list();
    res.json({ rules, total: rules.length, updatedAt: new Date().toISOString() });
  } catch (error) { sendError(res, error); }
});

router.post("/", async (req, res) => {
  try {
    const rule = await rewardRuleService.create(req.body, req.commandSteamId);
    res.status(201).json({ rule });
  } catch (error) { sendError(res, error); }
});

router.put("/:id", async (req, res) => {
  try {
    const rule = await rewardRuleService.update(req.params.id, req.body, req.commandSteamId);
    res.json({ rule });
  } catch (error) { sendError(res, error); }
});

router.delete("/:id", async (req, res) => {
  try {
    await rewardRuleService.remove(req.params.id);
    res.status(204).end();
  } catch (error) { sendError(res, error); }
});

module.exports = router;
