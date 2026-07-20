const express = require("express");

const router = express.Router();
const discordController = require("../controllers/discordController");

router.get("/status", discordController.status);
router.get("/stats", discordController.stats);

router.get("/login", discordController.login);
router.get("/callback", discordController.callback);
router.post("/unlink", discordController.unlink);

module.exports = router;