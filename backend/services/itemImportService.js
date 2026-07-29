const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const { execFile } = require("child_process");
const { promisify } = require("util");
const { upsertImportedItems } = require("./itemCatalogService");

const execFileAsync = promisify(execFile);
const TYPE_PATTERN = /<type\s+[^>]*name\s*=\s*["']([^"']+)["'][^>]*>/gi;
const MAX_ARCHIVE_SIZE = 25 * 1024 * 1024;
const MAX_ARCHIVE_ENTRIES = 5000;
const MAX_XML_SIZE = 30 * 1024 * 1024;

function humanize(value) {
  return (
    String(value || "")
      .replace(/^@/, "")
      .replace(/^types[_-]?/i, "")
      .replace(/\.xml$/i, "")
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\b\w/g, (letter) => letter.toUpperCase()) || "Vanilla"
  );
}

function normalizeArchivePath(entry) {
  return String(entry || "").replace(/\\/g, "/").replace(/^\.\//, "");
}

function isTypesXml(entry) {
  const fileName = path.posix.basename(normalizeArchivePath(entry));
  return /^types(?:[_-].+)?\.xml$/i.test(fileName) || /[_-]types\.xml$/i.test(fileName);
}

function modNameFromEntry(entry) {
  const normalized = normalizeArchivePath(entry);
  const segments = normalized.split("/").filter(Boolean);
  const fileName = segments.at(-1) || "types.xml";

  if (/^types\.xml$/i.test(fileName)) {
    const usefulParent = [...segments.slice(0, -1)]
      .reverse()
      .find((segment) => !/^(db|economy|missions?|mpmissions?|chernarusplus|storage_\d+|cfgeconomycore)$/i.test(segment));

    if (usefulParent) return humanize(usefulParent);
    return "Vanilla";
  }

  return humanize(fileName);
}

function inferCategory(className, sourcePath) {
  const value = `${className} ${sourcePath}`.toLowerCase();
  if (/(ammo|magazine|bullet|round|grenade|explosive)/.test(value)) return "Munitions";
  if (/(rifle|pistol|shotgun|smg|weapon|m4|akm|knife|sword|axe|bow)/.test(value)) return "Armes";
  if (/(car|truck|vehicle|wheel|door|hood|battery|radiator|sparkplug|key)/.test(value)) return "Véhicules";
  if (/(vest|jacket|pants|shirt|helmet|gloves|boots|mask|suit|hoodie)/.test(value)) return "Vêtements";
  if (/(backpack|bag|pouch|case|container|barrel|crate|locker|safe)/.test(value)) return "Conteneurs";
  if (/(food|meat|can|drink|water|bottle|cannabis|seed|fruit|vegetable)/.test(value)) return "Nourriture & ressources";
  if (/(medical|bandage|saline|morphine|epinephrine|blood|syringe|antibiotic)/.test(value)) return "Médical";
  if (/(building|bbp|wall|floor|roof|garage|workbench|craft|material|plank|nail)/.test(value)) return "Construction";
  return "Autre";
}

function inferSubcategory(className, category) {
  const value = String(className || "").toLowerCase();

  if (category === "Armes") {
    if (/(pistol|glock|deagle|revolver)/.test(value)) return "Arme de poing";
    if (/(shotgun|saiga)/.test(value)) return "Fusil à pompe";
    if (/(sniper|svd|mosin|dmr)/.test(value)) return "Précision";
    if (/(smg|mp5|ump)/.test(value)) return "Pistolet-mitrailleur";
    return "Arme longue";
  }

  if (category === "Véhicules") {
    if (/(wheel|door|hood|battery|radiator|sparkplug)/.test(value)) return "Pièce détachée";
    return "Véhicule";
  }

  if (category === "Vêtements") {
    if (/(helmet|mask|hat|hood)/.test(value)) return "Tête";
    if (/(vest|jacket|shirt|hoodie)/.test(value)) return "Haut du corps";
    if (/(pants)/.test(value)) return "Bas du corps";
    if (/(boots|shoes)/.test(value)) return "Chaussures";
  }

  return null;
}

async function validateArchive(zipPath) {
  const { stdout } = await execFileAsync("unzip", ["-Z1", zipPath], {
    maxBuffer: 10 * 1024 * 1024
  });

  const entries = stdout.split(/\r?\n/).map(normalizeArchivePath).filter(Boolean);

  if (!entries.length) throw new Error("Le ZIP est vide.");
  if (entries.length > MAX_ARCHIVE_ENTRIES) {
    throw new Error(`Le ZIP contient trop de fichiers (${entries.length}/${MAX_ARCHIVE_ENTRIES}).`);
  }

  for (const entry of entries) {
    if (path.posix.isAbsolute(entry) || entry.split("/").includes("..")) {
      throw new Error("Le ZIP contient un chemin non sécurisé.");
    }
  }

  return entries;
}

function mergeDuplicateItem(current, incoming) {
  if (!current) return incoming;

  const sources = new Set([
    ...(current.metadata?.source_paths || []),
    ...(incoming.metadata?.source_paths || []),
    current.source_path,
    incoming.source_path
  ].filter(Boolean));

  return {
    ...current,
    metadata: {
      ...(current.metadata || {}),
      ...(incoming.metadata || {}),
      source_paths: [...sources]
    }
  };
}

async function importZipBuffer(buffer) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) {
    throw new Error("Aucun fichier ZIP reçu.");
  }

  if (buffer.length > MAX_ARCHIVE_SIZE) {
    throw new Error("Le ZIP dépasse la limite de 25 Mo.");
  }

  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "senzany-items-"));
  const zipPath = path.join(tempRoot, "types.zip");

  try {
    await fs.writeFile(zipPath, buffer);
    const entries = await validateArchive(zipPath);
    const xmlEntries = [...new Set(entries.filter(isTypesXml))];

    if (!xmlEntries.length) {
      throw new Error("Aucun fichier types*.xml trouvé dans le ZIP.");
    }

    const unique = new Map();
    const mods = new Set();
    let occurrences = 0;
    let parsedFiles = 0;

    for (const entry of xmlEntries) {
      const { stdout: xml } = await execFileAsync("unzip", ["-p", zipPath, entry], {
        maxBuffer: MAX_XML_SIZE,
        encoding: "utf8"
      });

      const sourcePath = normalizeArchivePath(entry);
      const sourceFile = path.posix.basename(sourcePath);
      const modName = modNameFromEntry(sourcePath);
      let match;
      let fileHasTypes = false;
      TYPE_PATTERN.lastIndex = 0;

      while ((match = TYPE_PATTERN.exec(xml)) !== null) {
        const className = String(match[1] || "").trim();
        if (!className) continue;

        fileHasTypes = true;
        occurrences += 1;
        mods.add(modName);

        const category = inferCategory(className, sourcePath);
        const item = {
          classname: className,
          display_name: className,
          category,
          subcategory: inferSubcategory(className, category),
          mod_name: modName,
          source_file: sourceFile,
          source_path: sourcePath,
          is_active: true,
          delivery_enabled: true,
          shop_enabled: false,
          battle_pass_enabled: false,
          reward_enabled: true,
          metadata: {
            source_paths: [sourcePath],
            imported_from_types_xml: true
          },
          last_seen_at: new Date().toISOString()
        };

        const key = className.toLowerCase();
        unique.set(key, mergeDuplicateItem(unique.get(key), item));
      }

      if (fileHasTypes) parsedFiles += 1;
    }

    const items = [...unique.values()];
    if (!items.length) {
      throw new Error("Aucun classname DayZ trouvé dans les fichiers types*.xml.");
    }

    const imported = await upsertImportedItems(items);

    return {
      archiveEntries: entries.length,
      files: parsedFiles,
      mods: mods.size,
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
