const { createClient } = require("@supabase/supabase-js");

function getSupabaseClient() {
  const url = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const key = process.env.SUPABASE_SECRET_KEY;

  if (!url || !key) {
    throw new Error("SUPABASE_URL ou SUPABASE_SECRET_KEY manquante.");
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

function normalizeItem(row) {
  return {
    id: row.id,
    className: row.classname,
    displayName: row.display_name || row.classname,
    category: row.category || "Autre",
    modName: row.mod_name || "Inconnu",
    sourceFile: row.source_file || null,
    active: row.is_active !== false,
    updatedAt: row.updated_at
  };
}

async function searchItems({ query = "", mod = "", limit = 50, offset = 0 } = {}) {
  const supabase = getSupabaseClient();
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const safeOffset = Math.max(Number(offset) || 0, 0);

  let request = supabase
    .from("items")
    .select("id,classname,display_name,category,mod_name,source_file,is_active,updated_at", { count: "exact" })
    .eq("is_active", true)
    .order("classname", { ascending: true })
    .range(safeOffset, safeOffset + safeLimit - 1);

  if (query) {
    const escaped = String(query).replace(/[,%()]/g, " ").trim();
    if (escaped) {
      request = request.or(`classname.ilike.%${escaped}%,display_name.ilike.%${escaped}%`);
    }
  }

  if (mod) {
    request = request.eq("mod_name", mod);
  }

  const { data, error, count } = await request;
  if (error) throw error;

  return {
    items: Array.isArray(data) ? data.map(normalizeItem) : [],
    total: Number(count) || 0,
    limit: safeLimit,
    offset: safeOffset
  };
}

async function getItemStats() {
  const supabase = getSupabaseClient();

  const [{ count, error: countError }, { data: mods, error: modsError }] = await Promise.all([
    supabase.from("items").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("items").select("mod_name").eq("is_active", true).order("mod_name")
  ]);

  if (countError) throw countError;
  if (modsError) throw modsError;

  return {
    total: Number(count) || 0,
    mods: [...new Set((mods || []).map((row) => row.mod_name).filter(Boolean))]
  };
}

async function upsertItems(items, batchSize = 400) {
  const supabase = getSupabaseClient();
  let processed = 0;

  for (let index = 0; index < items.length; index += batchSize) {
    const batch = items.slice(index, index + batchSize);
    const { error } = await supabase
      .from("items")
      .upsert(batch, { onConflict: "classname", ignoreDuplicates: false });

    if (error) throw error;
    processed += batch.length;
  }

  return processed;
}

module.exports = { searchItems, getItemStats, upsertItems };
