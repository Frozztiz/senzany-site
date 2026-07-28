const { searchItems, getItemStats } = require("../services/itemCatalogService");
const { importZipBuffer } = require("../services/itemImportService");

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

module.exports = { search, stats, importArchive };
