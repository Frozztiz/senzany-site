const express = require("express");
const router = express.Router();
const itemsController = require("../controllers/itemsController");

router.get("/", itemsController.search);
router.get("/stats", itemsController.stats);
router.patch("/:id", itemsController.update);
router.post("/classify", itemsController.classify);
router.get("/images/stats", itemsController.imageStats);
router.post("/images/process", itemsController.processImages);
router.post("/images/reset", itemsController.resetImages);
router.post(
  "/import",
  express.raw({ type: ["application/zip", "application/octet-stream"], limit: "25mb" }),
  itemsController.importArchive
);

module.exports = router;
