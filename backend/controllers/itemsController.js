const { searchItems, getItemStats } = require("../services/itemCatalogService");
const { importZipBuffer } = require("../services/itemImportService");
const { getImageStats, processImageBatch, resetImageSearch } = require("../services/itemImageService");

async function search(req, res, next) {
  try {
    const result = await searchItems({
      query: req.query.q || "",
      mod: req.query.mod || "",
      limit: req.query.limit || 50,
      offset: req.query.offset || 0
    });
    res.json(result);
  } catch (error) { next(error); }
}

async function stats(req, res, next) {
  try { res.json(await getItemStats()); }
  catch (error) { next(error); }
}

async function imageStats(req, res, next) {
  try { res.json(await getImageStats()); }
  catch (error) { next(error); }
}

async function processImages(req, res, next) {
  try {
    const result = await processImageBatch({
      batchSize: req.body?.batchSize || 20,
      retryMissing: Boolean(req.body?.retryMissing)
    });
    res.json({ ok: true, ...result });
  } catch (error) { next(error); }
}

async function resetImages(req, res, next) {
  try {
    const stats = await resetImageSearch({ onlyMissing: req.body?.onlyMissing !== false });
    res.json({ ok: true, stats });
  } catch (error) { next(error); }
}

async function importArchive(req, res, next) {
  try {
    const result = await importZipBuffer(req.body);
    console.log(`[ITEMS] Import par ${req.commandSteamId}: ${result.uniqueItems} objets / ${result.files} XML`);
    res.status(201).json({ ok: true, ...result });
  } catch (error) {
    const message = String(error?.message || "");
    if (/ZIP|types.*xml|25 Mo|chemin non sécurisé|trop de fichiers/i.test(message)) {
      return res.status(400).json({ error: message });
    }
    next(error);
  }
}

module.exports = { search, stats, imageStats, processImages, resetImages, importArchive };
