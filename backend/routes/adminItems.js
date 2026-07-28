const express = require("express");
const router = express.Router();
const itemsController = require("../controllers/itemsController");

router.get("/", itemsController.search);
router.get("/stats", itemsController.stats);
router.post(
  "/import",
  express.raw({ type: ["application/zip", "application/octet-stream"], limit: "25mb" }),
  itemsController.importArchive
);

module.exports = router;
