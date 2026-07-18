const express = require("express");
const router = express.Router();

const topServeursService = require("../services/topServeursService");

router.get("/stats", async (req, res) => {
  try {
    const stats = await topServeursService.getStats();
    res.json(stats);
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: err.message,
    });
  }
});

module.exports = router;