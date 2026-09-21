const express = require("express");
const router = express.Router();
const inventorySnapshotService = require("../services/inventorySnapshotService");

router.get("/", (req, res) => {
  res.set("Cache-Control", "no-store");
  return res.json({ snapshots: inventorySnapshotService.listSnapshots() });
});

module.exports = router;
