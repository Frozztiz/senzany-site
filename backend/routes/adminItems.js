const express = require("express");
const { searchItems, getItemsStats } = require("../services/itemService");
const { importItemsZip } = require("../services/itemImporter");

const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    const items = await searchItems({
      search: req.query.search,
      category: req.query.category,
      limit: req.query.limit,
    });
    res.json({ items });
  } catch (error) { next(error); }
});

router.get("/stats", async (_req, res, next) => {
  try { res.json(await getItemsStats()); }
  catch (error) { next(error); }
});

router.post(
  "/import",
  express.raw({ type: ["application/zip", "application/octet-stream"], limit: "20mb" }),
  async (req, res, next) => {
    try {
      if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
        return res.status(400).json({ error: "Sélectionne un fichier ZIP contenant les types.xml." });
      }
      const result = await importItemsZip(req.body);
      res.json({ ok: true, ...result });
    } catch (error) {
      if (/ZIP|XML|objet|fichier|volumineux|compression/i.test(error.message)) {
        return res.status(400).json({ error: error.message });
      }
      next(error);
    }
  }
);

module.exports = router;
