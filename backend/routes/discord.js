const express = require("express");
const router = express.Router();

const discordController = require("../controllers/discordController");

router.get("/status", discordController.status);

module.exports = router;