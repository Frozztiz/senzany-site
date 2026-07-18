const express = require("express");
const router = express.Router();

router.get("/stats", async (req, res) => {
  res.json({
    online: true,
    players: null,
    message: "Game stats route prête"
  });
});

module.exports = router;