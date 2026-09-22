const express = require("express");
const router = express.Router();
const deliveryAgentAuth = require("../middleware/deliveryAgentAuth");
const inventorySnapshotService = require("../services/inventorySnapshotService");

router.use(deliveryAgentAuth);

router.post("/", (req, res) => {
  try {
    const snapshot = inventorySnapshotService.saveSnapshot({
      steamId: req.body?.steamId,
      playerName: req.body?.playerName,
      agentId: req.body?.agentId,
      items: req.body?.items
    });
    res.set("Cache-Control", "no-store");
    return res.json({ success: true, steamId: snapshot.steamId, itemCount: snapshot.items.length });
  } catch (error) {
    console.error("[INVENTORY SNAPSHOT]", error);
    return res.status(400).json({ error: error.message || "Snapshot invalide." });
  }
});

module.exports = router;
