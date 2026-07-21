const express = require("express");
const router = express.Router();

const deliveriesController = require("../controllers/deliveriesController");

router.get("/", deliveriesController.list);
router.post("/", deliveriesController.create);
router.get("/:id", deliveriesController.get);
router.patch("/:id", deliveriesController.update);
router.delete("/:id", deliveriesController.remove);

module.exports = router;