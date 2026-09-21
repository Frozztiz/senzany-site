const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
const DATA_FILE = path.join(DATA_DIR, "inventory-snapshots.json");
const MAX_AGE_MS = 5 * 60 * 1000;
const MAX_ITEMS = 500;

function clean(value, max = 160) {
  return String(value || "").trim().slice(0, max);
}
function readAll() {
  try {
    const parsed = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (_) { return {}; }
}
function writeAll(data) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${DATA_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8");
  fs.renameSync(tmp, DATA_FILE);
}
function normalizeItems(items) {
  if (!Array.isArray(items)) return [];
  return items.slice(0, MAX_ITEMS).map(item => {
    const className = clean(item?.className || item?.classname, 150);
    const quantity = Math.max(1, Math.min(999999, Math.floor(Number(item?.quantity) || 1)));
    const health = Number(item?.healthPercent);
    return {
      className,
      displayName: clean(item?.displayName || item?.name || className, 160),
      quantity,
      healthPercent: Number.isFinite(health) ? Math.max(0, Math.min(100, health)) : null
    };
  }).filter(x => x.className);
}
function saveSnapshot(input) {
  const steamId = clean(input?.steamId, 17);
  if (!/^\d{17}$/.test(steamId)) throw new Error("SteamID invalide.");
  const all = readAll();
  all[steamId] = {
    steamId,
    playerName: clean(input?.playerName, 100),
    agentId: clean(input?.agentId, 100),
    capturedAt: new Date().toISOString(),
    items: normalizeItems(input?.items)
  };
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  for (const [id, row] of Object.entries(all)) {
    if (!row?.capturedAt || new Date(row.capturedAt).getTime() < cutoff) delete all[id];
  }
  writeAll(all);
  return all[steamId];
}
function listSnapshots() {
  const now = Date.now();
  return Object.values(readAll())
    .filter(x => x?.capturedAt && now - new Date(x.capturedAt).getTime() <= MAX_AGE_MS)
    .sort((a,b) => String(a.playerName||"").localeCompare(String(b.playerName||""),"fr"));
}
module.exports = { saveSnapshot, listSnapshots };
