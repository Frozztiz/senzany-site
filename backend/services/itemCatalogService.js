const { createClient } = require("@supabase/supabase-js");

const DEFAULT_CATEGORY = "Autre";
const DEFAULT_MOD_NAME = "Inconnu";

function getSupabaseClient() {
  const url = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const key = process.env.SUPABASE_SECRET_KEY;

  if (!url || !key) {
    throw new Error("SUPABASE_URL ou SUPABASE_SECRET_KEY manquante.");
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

function humanizeSourceFile(sourceFile) {
  const value = String(sourceFile || "").replace(/\.xml$/i, "");

  if (!value) return "Source non identifiée";
  if (/^types$/i.test(value)) return "Vanilla";

  return (
    value
      .replace(/^types[_-]?/i, "")
      .replace(/[_-]+/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase()) ||
    "Source non identifiée"
  );
}

function normalizeItem(row) {
  return {
    id: row.id,
    className: row.classname,
    displayName: row.display_name || row.classname,
    category: row.category || "Non classé",
    subcategory: row.subcategory || null,
    modName: row.mod_name || humanizeSourceFile(row.source_file),
    sourceFile: row.source_file || null,
    sourcePath: row.source_path || null,
    active: row.is_active !== false,
    deliveryEnabled: row.delivery_enabled !== false,
    shopEnabled: row.shop_enabled === true,
    battlePassEnabled: row.battle_pass_enabled === true,
    rewardEnabled: row.reward_enabled !== false,
    imageUrl: row.image_url || null,
    imageStatus: row.image_status || null,
    firstSeenAt: row.first_seen_at || null,
    lastSeenAt: row.last_seen_at || null,
    updatedAt: row.updated_at
  };
}

function sanitizeSearchValue(value) {
  return String(value || "")
    .replace(/[,%()]/g, " ")
    .trim();
}

async function searchItems({
  query = "",
  mod = "",
  category = "",
  availability = "",
  limit = 50,
  offset = 0
} = {}) {
  const supabase = getSupabaseClient();

  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const safeOffset = Math.max(Number(offset) || 0, 0);

  let request = supabase
    .from("items")
    .select(
      [
        "id",
        "classname",
        "display_name",
        "category",
        "subcategory",
        "mod_name",
        "source_file",
        "source_path",
        "is_active",
        "delivery_enabled",
        "shop_enabled",
        "battle_pass_enabled",
        "reward_enabled",
        "image_url",
        "image_status",
        "first_seen_at",
        "last_seen_at",
        "updated_at"
      ].join(","),
      { count: "exact" }
    )
    .eq("is_active", true)
    .order("classname", { ascending: true })
    .range(safeOffset, safeOffset + safeLimit - 1);

  const safeQuery = sanitizeSearchValue(query);
  if (safeQuery) {
    request = request.or(
      `classname.ilike.%${safeQuery}%,display_name.ilike.%${safeQuery}%`
    );
  }

  const safeMod = sanitizeSearchValue(mod);
  if (safeMod) request = request.eq("mod_name", safeMod);

  const safeCategory = sanitizeSearchValue(category);
  if (safeCategory) request = request.eq("category", safeCategory);

  const availabilityColumns = {
    delivery: "delivery_enabled",
    shop: "shop_enabled",
    battle_pass: "battle_pass_enabled",
    reward: "reward_enabled"
  };

  if (availabilityColumns[availability]) {
    request = request.eq(availabilityColumns[availability], true);
  }

  const { data, error, count } = await request;

  if (error) {
    console.error("ERREUR SUPABASE ITEMS :", error);
    throw error;
  }

  return {
    items: Array.isArray(data) ? data.map(normalizeItem) : [],
    total: Number(count) || 0,
    limit: safeLimit,
    offset: safeOffset
  };
}

async function getItemStats() {
  const supabase = getSupabaseClient();

  const [
    totalResult,
    modsResult,
    categoriesResult,
    deliveryResult,
    shopResult,
    battlePassResult,
    rewardResult
  ] = await Promise.all([
    supabase.from("items").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("items").select("mod_name").eq("is_active", true).order("mod_name"),
    supabase.from("items").select("category").eq("is_active", true).order("category"),
    supabase.from("items").select("id", { count: "exact", head: true }).eq("is_active", true).eq("delivery_enabled", true),
    supabase.from("items").select("id", { count: "exact", head: true }).eq("is_active", true).eq("shop_enabled", true),
    supabase.from("items").select("id", { count: "exact", head: true }).eq("is_active", true).eq("battle_pass_enabled", true),
    supabase.from("items").select("id", { count: "exact", head: true }).eq("is_active", true).eq("reward_enabled", true)
  ]);

  const results = [
    totalResult,
    modsResult,
    categoriesResult,
    deliveryResult,
    shopResult,
    battlePassResult,
    rewardResult
  ];

  for (const result of results) {
    if (result.error) throw result.error;
  }

  return {
    total: Number(totalResult.count) || 0,
    mods: [...new Set((modsResult.data || []).map((row) => row.mod_name).filter(Boolean))],
    categories: [...new Set((categoriesResult.data || []).map((row) => row.category).filter(Boolean))],
    availability: {
      delivery: Number(deliveryResult.count) || 0,
      shop: Number(shopResult.count) || 0,
      battlePass: Number(battlePassResult.count) || 0,
      reward: Number(rewardResult.count) || 0
    }
  };
}

function shouldKeepExistingText(currentValue, defaultValue, classname) {
  const value = String(currentValue || "").trim();
  if (!value) return false;
  if (value === classname) return false;
  return value.toLowerCase() !== String(defaultValue || "").toLowerCase();
}

async function getExistingItems(classnames) {
  const supabase = getSupabaseClient();
  const existing = new Map();

  for (let index = 0; index < classnames.length; index += 300) {
    const batch = classnames.slice(index, index + 300);
    const { data, error } = await supabase
      .from("items")
      .select(
        "classname,display_name,category,subcategory,mod_name,source_file,source_path,is_active,delivery_enabled,shop_enabled,battle_pass_enabled,reward_enabled,metadata,first_seen_at,import_count"
      )
      .in("classname", batch);

    if (error) throw error;

    for (const row of data || []) {
      existing.set(String(row.classname).toLowerCase(), row);
    }
  }

  return existing;
}

function mergeImportedItem(imported, existing) {
  const now = new Date().toISOString();

  if (!existing) {
    return {
      ...imported,
      first_seen_at: imported.first_seen_at || now,
      last_seen_at: now,
      import_count: 1
    };
  }

  const existingMetadata = existing.metadata && typeof existing.metadata === "object"
    ? existing.metadata
    : {};
  const importedMetadata = imported.metadata && typeof imported.metadata === "object"
    ? imported.metadata
    : {};

  return {
    ...imported,
    display_name: shouldKeepExistingText(existing.display_name, "", imported.classname)
      ? existing.display_name
      : imported.display_name,
    category: shouldKeepExistingText(existing.category, DEFAULT_CATEGORY, imported.classname)
      ? existing.category
      : imported.category,
    subcategory: existing.subcategory || imported.subcategory || null,
    mod_name: shouldKeepExistingText(existing.mod_name, DEFAULT_MOD_NAME, imported.classname)
      ? existing.mod_name
      : imported.mod_name,
    is_active: existing.is_active !== false,
    delivery_enabled: existing.delivery_enabled !== false,
    shop_enabled: existing.shop_enabled === true,
    battle_pass_enabled: existing.battle_pass_enabled === true,
    reward_enabled: existing.reward_enabled !== false,
    metadata: {
      ...importedMetadata,
      ...existingMetadata
    },
    first_seen_at: existing.first_seen_at || imported.first_seen_at || now,
    last_seen_at: now,
    import_count: Math.max(Number(existing.import_count) || 1, 1) + 1
  };
}

async function upsertImportedItems(items, batchSize = 300) {
  if (!Array.isArray(items) || !items.length) return 0;

  const supabase = getSupabaseClient();
  const existingItems = await getExistingItems(items.map((item) => item.classname));
  let processed = 0;

  for (let index = 0; index < items.length; index += batchSize) {
    const batch = items.slice(index, index + batchSize).map((item) => {
      const existing = existingItems.get(String(item.classname).toLowerCase());
      return mergeImportedItem(item, existing);
    });

    const { error } = await supabase
      .from("items")
      .upsert(batch, {
        onConflict: "classname",
        ignoreDuplicates: false
      });

    if (error) throw error;
    processed += batch.length;
  }

  return processed;
}

module.exports = {
  searchItems,
  getItemStats,
  upsertImportedItems
};
