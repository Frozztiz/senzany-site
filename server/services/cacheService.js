const fs = require("fs/promises");
const path = require("path");

const CACHE_DIRECTORY = path.join(__dirname, "..", "cache");

function getCachePath(cacheName) {
  const safeName = String(cacheName).replace(/[^a-zA-Z0-9_-]/g, "");
  return path.join(CACHE_DIRECTORY, `${safeName}.json`);
}

async function saveCache(cacheName, data) {
  await fs.mkdir(CACHE_DIRECTORY, { recursive: true });

  const cachePath = getCachePath(cacheName);
  const temporaryPath = `${cachePath}.tmp`;

  const payload = {
    savedAt: new Date().toISOString(),
    data,
  };

  await fs.writeFile(
    temporaryPath,
    JSON.stringify(payload, null, 2),
    "utf8"
  );

  await fs.rename(temporaryPath, cachePath);

  return payload;
}

async function loadCache(cacheName) {
  try {
    const cachePath = getCachePath(cacheName);
    const content = await fs.readFile(cachePath, "utf8");
    const payload = JSON.parse(content);

    if (!payload || typeof payload !== "object" || !payload.data) {
      return null;
    }

    return payload;
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error(
        `[Cache] Impossible de lire ${cacheName} :`,
        error.message
      );
    }

    return null;
  }
}

module.exports = {
  saveCache,
  loadCache,
};
