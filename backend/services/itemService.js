const { request } = require("./supabaseService");

function sanitizeLimit(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return 25;
  return Math.min(Math.max(parsed, 1), 100);
}

function normalizeSearch(value) {
  return String(value || "")
    .trim()
    .replace(/[,*()]/g, " ")
    .slice(0, 80);
}

async function searchItems({ search = "", category = "", limit = 25 } = {}) {
  const params = new URLSearchParams();
  params.set("select", "id,classname,display_name,category,mod_name,source_files,is_active");
  params.set("is_active", "eq.true");
  params.set("order", "display_name.asc");
  params.set("limit", String(sanitizeLimit(limit)));

  const normalizedSearch = normalizeSearch(search);
  if (normalizedSearch) {
    params.set("or", `(classname.ilike.*${normalizedSearch}*,display_name.ilike.*${normalizedSearch}*)`);
  }

  const normalizedCategory = String(category || "").trim();
  if (normalizedCategory) params.set("category", `eq.${normalizedCategory}`);

  const rows = await request(`items?${params.toString()}`, { method: "GET" });
  return Array.isArray(rows) ? rows : [];
}

async function getItemsStats() {
  const rows = await request("items?select=id&is_active=eq.true", {
    method: "GET",
    headers: { Prefer: "count=exact", Range: "0-0" },
    returnMeta: true,
  });

  return { total: rows.count || 0 };
}

async function upsertItems(items, batchSize = 300) {
  let processed = 0;
  for (let index = 0; index < items.length; index += batchSize) {
    const batch = items.slice(index, index + batchSize);
    await request("items?on_conflict=classname", {
      method: "POST",
      headers: {
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(batch),
    });
    processed += batch.length;
  }

  return processed;
}

async function getAllItems(batchSize = 1000) {
  const all = [];

  for (let start = 0; ; start += batchSize) {
    const end = start + batchSize - 1;
    const rows = await request(
      "items?select=id,classname,is_active&order=id.asc",
      {
        method: "GET",
        headers: { Range: `${start}-${end}` },
      }
    );

    const page = Array.isArray(rows) ? rows : [];
    all.push(...page);

    if (page.length < batchSize) break;
  }

  return all;
}

async function patchItemsByIds(ids, payload, batchSize = 200) {
  let processed = 0;

  for (let index = 0; index < ids.length; index += batchSize) {
    const batch = ids.slice(index, index + batchSize).filter(Boolean);
    if (!batch.length) continue;

    await request(`items?id=in.(${batch.join(",")})`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(payload),
    });

    processed += batch.length;
  }

  return processed;
}

/**
 * Synchronise Supabase avec le catalogue courant.
 *
 * Règles :
 * - un classname déjà connu conserve ses champs enrichis/manuels
 *   (display_name, category, image, disponibilités, etc.) ;
 * - un classname nouveau est créé avec les données générées par l'importeur ;
 * - un ancien classname absent du nouveau catalogue est seulement désactivé ;
 * - aucun objet n'est supprimé.
 */
async function syncItems(items) {
  const now = new Date().toISOString();
  const existingRows = await getAllItems();
  const existingByClassname = new Map(
    existingRows
      .filter((row) => row?.classname)
      .map((row) => [String(row.classname).toLowerCase(), row])
  );

  const incomingKeys = new Set(
    items
      .filter((item) => item?.classname)
      .map((item) => String(item.classname).toLowerCase())
  );

  const newItems = [];
  const reactivateIds = [];

  for (const item of items) {
    const key = String(item.classname || "").toLowerCase();
    const existing = existingByClassname.get(key);

    if (!existing) {
      newItems.push(item);
      continue;
    }

    if (existing.is_active === false) reactivateIds.push(existing.id);
  }

  // On n'insère que les nouveaux classnames.
  // Les fiches existantes ne sont volontairement pas réécrites afin de préserver
  // les enrichissements effectués dans le portail.
  const added = newItems.length ? await upsertItems(newItems) : 0;

  const reactivated = reactivateIds.length
    ? await patchItemsByIds(reactivateIds, { is_active: true, updated_at: now })
    : 0;

  const staleIds = existingRows
    .filter((row) =>
      row?.id &&
      row?.classname &&
      row.is_active !== false &&
      !incomingKeys.has(String(row.classname).toLowerCase())
    )
    .map((row) => row.id);

  const deactivated = staleIds.length
    ? await patchItemsByIds(staleIds, { is_active: false, updated_at: now })
    : 0;

  return {
    current: items.length,
    added,
    reactivated,
    deactivated,
    previouslyKnown: Math.max(0, items.length - newItems.length),
  };
}

module.exports = {
  searchItems,
  getItemsStats,
  upsertItems,
  getAllItems,
  syncItems,
};
