const express = require("express");
const router = express.Router();

const topServeursService = require("../services/topServeursService");
const voteAliasService = require("../services/voteAliasService");
const { verifySteamId } = require("../utils/steamSession");
const voteWalletService = require("../services/voteWalletService");

function getAuthenticatedSteamId(req, res) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    res.status(500).json({ error: "SESSION_SECRET manquant." });
    return null;
  }

  const steamId = verifySteamId(req.cookies?.senzany_session, secret);
  if (!steamId) {
    res.status(401).json({ error: "Connexion Steam requise." });
    return null;
  }

  return steamId;
}

function aliasErrorStatus(error) {
  if (["INVALID_ALIAS_LENGTH", "INVALID_ALIAS", "INVALID_ALIAS_ID"].includes(error.code)) return 400;
  if (error.code === "ALIAS_ALREADY_USED") return 409;
  if (error.code === "ALIAS_LIMIT_REACHED") return 422;
  if (error.code === "ALIAS_NOT_FOUND") return 404;
  return 500;
}

router.get("/stats", async (req, res) => {
  try {
    const stats = await topServeursService.getStats();
    res.json(stats);
  } catch (err) {
    console.error("Top-Serveurs stats:", err);
    res.status(500).json({ error: err.message });
  }
});

router.get("/aliases", async (req, res) => {
  res.set("Cache-Control", "no-store");
  const steamId = getAuthenticatedSteamId(req, res);
  if (!steamId) return;

  try {
    const aliases = await voteAliasService.listBySteamId(steamId);
    return res.json({ aliases, limit: voteAliasService.MAX_ALIASES_PER_PLAYER });
  } catch (error) {
    console.error("Top-Serveurs aliases list:", error);
    return res.status(500).json({ error: error.message || "Impossible de récupérer les pseudos de vote." });
  }
});

router.post("/aliases", async (req, res) => {
  res.set("Cache-Control", "no-store");
  const steamId = getAuthenticatedSteamId(req, res);
  if (!steamId) return;

  try {
    const requestedAlias = voteAliasService.cleanAlias(req.body?.alias);
    const baseline = await topServeursService.getPlayerVotes({ aliases: [requestedAlias] });
    const alias = await voteAliasService.addForSteamId(steamId, requestedAlias);
    await voteWalletService.registerAlias({ aliasEntry: alias, steamId, baselineVotes: Number(baseline.votes || 0) });
    return res.status(201).json({ alias });
  } catch (error) {
    console.error("Top-Serveurs alias add:", error);
    return res.status(aliasErrorStatus(error)).json({ error: error.message });
  }
});

router.delete("/aliases/:aliasId", async (req, res) => {
  res.set("Cache-Control", "no-store");
  const steamId = getAuthenticatedSteamId(req, res);
  if (!steamId) return;

  try {
    const aliases = await voteAliasService.listBySteamId(steamId);
    const target = aliases.find((entry) => String(entry.id) === String(req.params.aliasId));
    if (target) {
      const current = await topServeursService.getPlayerVotes({ aliases: aliases.map((entry) => entry.alias) });
      await voteWalletService.syncForPlayer({ steamId, aliases, aliasDetails: current.aliasDetails });
      await voteWalletService.closeAliasOwnership(target, steamId);
    }
    await voteAliasService.removeForSteamId(steamId, req.params.aliasId);
    return res.json({ success: true });
  } catch (error) {
    console.error("Top-Serveurs alias delete:", error);
    return res.status(aliasErrorStatus(error)).json({ error: error.message });
  }
});

router.get("/my-votes", async (req, res) => {
  res.set("Cache-Control", "no-store");
  const steamId = getAuthenticatedSteamId(req, res);
  if (!steamId) return;

  try {
    const aliases = await voteAliasService.listBySteamId(steamId);
    const result = await topServeursService.getPlayerVotes({
      aliases: aliases.map((entry) => entry.alias),
    });

    const walletSync = await voteWalletService.syncForPlayer({ steamId, aliases, aliasDetails: result.aliasDetails });
    const wallet = await voteWalletService.getSummary(steamId, result.votes);
    return res.json({
      ...result,
      configured: aliases.length > 0,
      aliases,
      wallet,
      walletSync: { creditedVotes: walletSync.creditedVotes, creditedAmount: walletSync.creditedAmount },
    });
  } catch (err) {
    console.error("Top-Serveurs my-votes:", err);
    return res.status(502).json({ error: "Classement Top-Serveurs indisponible." });
  }
});

module.exports = router;
