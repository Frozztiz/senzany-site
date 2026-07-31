const express = require("express");
const rconController = require("../controllers/rconController");

const router = express.Router();

router.get("/test", rconController.testRcon);

module.exports = router;
