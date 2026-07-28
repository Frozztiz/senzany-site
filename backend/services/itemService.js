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

module.exports = { searchItems, getItemsStats, upsertItems };
