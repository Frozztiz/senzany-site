const express = require("express");
const router = express.Router();
const controller = require("../controllers/deliveryAgentController");
const deliveryAgentAuth = require("../middleware/deliveryAgentAuth");

router.use(deliveryAgentAuth);
router.get("/health", controller.health);
router.post("/check", controller.check);
router.post("/claim", controller.claim);
router.post("/complete", controller.complete);

module.exports = router;
