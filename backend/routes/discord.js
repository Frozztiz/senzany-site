const express = require("express");
const router = express.Router();

const discordController = require("../controllers/discordController");

router.get("/status", discordController.status);
router.get("/stats", discordController.stats);

module.exports = router;