const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const { execFile } = require("child_process");
const { promisify } = require("util");
const { upsertItems } = require("./itemCatalogService");

const execFileAsync = promisify(execFile);
const TYPE_PATTERN = /<type\s+[^>]*name\s*=\s*["']([^"']+)["'][^>]*>/gi;

function humanize(value) {
  return String(value || "")
    .replace(/^types[_-]?/i, "")
    .replace(/\.xml$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase()) || "Vanilla";
}

function modNameFromFile(fileName) {
  const base = path.basename(fileName);
  return /^types\.xml$/i.test(base) ? "Vanilla" : humanize(base);
}

function inferCategory(className, sourceFile) {
  const value = `${className} ${sourceFile}`.toLowerCase();
  if (/(ammo|magazine|bullet|round|grenade)/.test(value)) return "Munitions";
  if (/(rifle|pistol|shotgun|smg|weapon|m4|akm|knife|sword|axe)/.test(value)) return "Armes";
  if (/(car|truck|vehicle|wheel|door|hood|battery|radiator|key)/.test(value)) return "Véhicules";
  if (/(vest|jacket|pants|shirt|helmet|gloves|boots|mask|suit)/.test(value)) return "Vêtements";
  if (/(backpack|bag|pouch|case|container|barrel|crate)/.test(value)) return "Conteneurs";
  if (/(food|meat|can|drink|water|bottle|cannabis|seed)/.test(value)) return "Nourriture & ressources";
  if (/(medical|bandage|saline|morphine|epinephrine|blood|syringe)/.test(value)) return "Médical";
  if (/(building|bbp|wall|floor|roof|garage|workbench|craft|material)/.test(value)) return "Construction";
  return "Autre";
}

async function validateArchive(zipPath) {
  const { stdout } = await execFileAsync("unzip", ["-Z1", zipPath], { maxBuffer: 5 * 1024 * 1024 });
  const entries = stdout.split(/\r?\n/).filter(Boolean);
  if (!entries.length) throw new Error("Le ZIP est vide.");
  if (entries.length > 2000) throw new Error("Le ZIP contient trop de fichiers.");
  for (const entry of entries) {
    if (path.isAbsolute(entry) || entry.split(/[\\/]/).includes("..")) {
      throw new Error("Le ZIP contient un chemin non sécurisé.");
    }
  }
  return entries;
}

async function importZipBuffer(buffer) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) throw new Error("Aucun fichier ZIP reçu.");
  if (buffer.length > 25 * 1024 * 1024) throw new Error("Le ZIP dépasse la limite de 25 Mo.");

  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "senzany-items-"));
  const zipPath = path.join(tempRoot, "types.zip");

  try {
    await fs.writeFile(zipPath, buffer);
    const entries = await validateArchive(zipPath);
    const xmlEntries = [...new Set(entries.filter((entry) => /\.xml$/i.test(entry)))];
    if (!xmlEntries.length) throw new Error("Aucun fichier XML trouvé dans le ZIP.");

    const unique = new Map();
    let occurrences = 0;
    let parsedFiles = 0;

    for (const entry of xmlEntries) {
      const { stdout: xml } = await execFileAsync("unzip", ["-p", zipPath, entry], {
        maxBuffer: 30 * 1024 * 1024,
        encoding: "utf8"
      });
      const sourceFile = path.basename(entry);
      const modName = modNameFromFile(sourceFile);
      let match;
      let fileHasTypes = false;
      TYPE_PATTERN.lastIndex = 0;

      while ((match = TYPE_PATTERN.exec(xml)) !== null) {
        fileHasTypes = true;
        const className = String(match[1] || "").trim();
        if (!className) continue;
        occurrences += 1;
        const key = className.toLowerCase();
        if (!unique.has(key)) {
          unique.set(key, {
            classname: className,
            display_name: className,
            category: inferCategory(className, sourceFile),
            mod_name: modName,
            source_file: sourceFile,
            is_active: true,
            updated_at: new Date().toISOString()
          });
        }
      }
      if (fileHasTypes) parsedFiles += 1;
    }

    const items = [...unique.values()];
    if (!items.length) throw new Error("Aucun classname DayZ trouvé dans les XML.");
    const imported = await upsertItems(items);

    return {
      archiveEntries: entries.length,
      files: parsedFiles,
      occurrences,
      uniqueItems: items.length,
      duplicates: Math.max(occurrences - items.length, 0),
      imported
    };
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}

module.exports = { importZipBuffer };
