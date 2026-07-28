const zlib = require("node:zlib");
const path = require("node:path");
const { upsertItems } = require("./itemService");

const MAX_ZIP_SIZE = 20 * 1024 * 1024;
const MAX_FILES = 500;
const MAX_UNCOMPRESSED = 80 * 1024 * 1024;

function readZipEntries(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 22) throw new Error("Archive ZIP invalide.");
  if (buffer.length > MAX_ZIP_SIZE) throw new Error("Le ZIP dépasse la limite de 20 Mo.");

  const eocdSignature = 0x06054b50;
  let eocd = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i -= 1) {
    if (buffer.readUInt32LE(i) === eocdSignature) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("Fin d'archive ZIP introuvable.");

  const totalEntries = buffer.readUInt16LE(eocd + 10);
  const centralOffset = buffer.readUInt32LE(eocd + 16);
  if (totalEntries > MAX_FILES) throw new Error("Le ZIP contient trop de fichiers.");

  const entries = [];
  let cursor = centralOffset;
  let totalUncompressed = 0;

  for (let index = 0; index < totalEntries; index += 1) {
    if (buffer.readUInt32LE(cursor) !== 0x02014b50) throw new Error("Répertoire ZIP corrompu.");

    const method = buffer.readUInt16LE(cursor + 10);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const uncompressedSize = buffer.readUInt32LE(cursor + 24);
    const fileNameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const localOffset = buffer.readUInt32LE(cursor + 42);
    const fileName = buffer.subarray(cursor + 46, cursor + 46 + fileNameLength).toString("utf8");

    totalUncompressed += uncompressedSize;
    if (totalUncompressed > MAX_UNCOMPRESSED) throw new Error("Contenu décompressé trop volumineux.");

    if (!fileName.endsWith("/") && /(^|\/)[^/]*types[^/]*\.xml$/i.test(fileName)) {
      if (buffer.readUInt32LE(localOffset) !== 0x04034b50) throw new Error("Entrée ZIP invalide.");
      const localNameLength = buffer.readUInt16LE(localOffset + 26);
      const localExtraLength = buffer.readUInt16LE(localOffset + 28);
      const dataStart = localOffset + 30 + localNameLength + localExtraLength;
      const compressed = buffer.subarray(dataStart, dataStart + compressedSize);
      let content;
      if (method === 0) content = compressed;
      else if (method === 8) content = zlib.inflateRawSync(compressed);
      else throw new Error(`Compression ZIP non supportée pour ${fileName}.`);
      entries.push({ fileName, content: content.toString("utf8") });
    }

    cursor += 46 + fileNameLength + extraLength + commentLength;
  }

  return entries;
}

function humanize(value) {
  return String(value)
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}

function inferMod(fileName) {
  const base = path.basename(fileName, path.extname(fileName));
  const cleaned = base
    .replace(/^types?_?/i, "")
    .replace(/_?types?$/i, "")
    .replace(/^(new|sample)_?/i, "")
    .trim();
  return cleaned ? humanize(cleaned) : "Vanilla";
}

function inferCategory(classname, fileName) {
  const value = `${classname} ${fileName}`.toLowerCase();
  if (/(ammo|magazine|bullet|round|grenade)/.test(value)) return "Munitions";
  if (/(rifle|pistol|shotgun|weapon|snafu|knife|sword|axe)/.test(value)) return "Armes";
  if (/(car|vehicle|truck|boat|heli|raptor|wheel|engine|radiator)/.test(value)) return "Véhicules";
  if (/(jacket|pants|shirt|helmet|vest|glove|boot|suit|clothes|backpack)/.test(value)) return "Vêtements";
  if (/(medical|bandage|saline|morphine|epinephrine|blood|syringe)/.test(value)) return "Médical";
  if (/(food|meat|fish|can|drink|water|cannabis|seed)/.test(value)) return "Nourriture & ressources";
  if (/(storage|crate|barrel|chest|case|locker|tent)/.test(value)) return "Stockage";
  if (/(bbp|build|wall|floor|door|garage|material|craft)/.test(value)) return "Construction";
  return "Autres";
}

function parseItems(entries) {
  const catalog = new Map();
  let occurrences = 0;

  for (const entry of entries) {
    const regex = /<type\s+[^>]*name\s*=\s*["']([^"']+)["'][^>]*>/gi;
    let match;
    while ((match = regex.exec(entry.content)) !== null) {
      const classname = match[1].trim();
      if (!classname || classname.length > 200) continue;
      occurrences += 1;
      const existing = catalog.get(classname.toLowerCase());
      if (existing) {
        if (!existing.source_files.includes(path.basename(entry.fileName))) {
          existing.source_files.push(path.basename(entry.fileName));
        }
        continue;
      }
      catalog.set(classname.toLowerCase(), {
        classname,
        display_name: humanize(classname),
        category: inferCategory(classname, entry.fileName),
        mod_name: inferMod(entry.fileName),
        source_files: [path.basename(entry.fileName)],
        is_active: true,
        updated_at: new Date().toISOString(),
      });
    }
  }

  return { items: [...catalog.values()], occurrences };
}

async function importItemsZip(buffer) {
  const entries = readZipEntries(buffer);
  if (!entries.length) throw new Error("Aucun fichier types*.xml trouvé dans le ZIP.");
  const { items, occurrences } = parseItems(entries);
  if (!items.length) throw new Error("Aucun objet DayZ trouvé dans les XML.");
  const imported = await upsertItems(items);
  return {
    files: entries.length,
    imported,
    duplicates: Math.max(0, occurrences - items.length),
    occurrences,
  };
}

module.exports = { importItemsZip, readZipEntries, parseItems };
