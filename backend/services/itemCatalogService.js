const { createClient } = require("@supabase/supabase-js");

const DEFAULT_CATEGORY = "Autre";
const DEFAULT_MOD_NAME = "Inconnu";


const CATEGORY_RULES = [
  // Les règles les plus précises passent avant les règles générales.
  { category: "Chargeurs", subcategory: "Chargeurs", pattern: /(^|_)(mag|magazine)($|_)|drummag|(^|_)clip($|_)/i },
  { category: "Munitions", subcategory: "Boîtes et cartouches", pattern: /(^|_)(ammo|ammunition|ammobox|cartridge|bullet|rounds?)($|_)|box_?(9x|22|45|308|357|380|545|556|762|12ga)/i },

  { category: "Armes", subcategory: "Fusils à pompe", pattern: /(aa12|shotgun|saiga|benelli|remington|mossberg|bk43|bk133|vaiga)/i },
  { category: "Armes", subcategory: "Fusils de précision", pattern: /(sniper|svd|vss|mosin|winchester|tundra|m70|savana|kar98|awm|m24|barrett|cheytac|dmr)/i },
  { category: "Armes", subcategory: "Mitrailleuses", pattern: /(^|_)(lmg|mg42|m249|m240|pkm|rpk|minigun)($|_)/i },
  { category: "Armes", subcategory: "Pistolets-mitrailleurs", pattern: /(^|_)(smg|mp5|mp7|mp9|ump45|uzi|vector|scorpion|cz61|pp19|p90)($|_)/i },
  { category: "Armes", subcategory: "Pistolets", pattern: /(^|_)(pistol|handgun|glock|deagle|makarov|ij70|cz75|fnx45|colt1911|magnum|revolver|derringer)($|_)/i },
  { category: "Armes", subcategory: "Fusils et carabines", pattern: /(^|_)(gun|rifle|weapon)($|_)|(m4a1|m16|m14|akm|ak74|ak101|ak102|ak103|ak104|ak105|ak47|famas|fal|scar|aug|g36|hk416|acr|mk18|lemas|lar|ka101|ka74|kas74|sks|b95|cr527|cr550|repeater)/i },
  { category: "Armes", subcategory: "Armes de mêlée", pattern: /(sword|katana|machete|baseballbat|brassknuckle|sledgehammer)/i },

  { category: "Accessoires d'armes", subcategory: "Optiques et viseurs", pattern: /(optic|scope|sight|reddot|red_dot|acog|holo|reflex|nightvisionoptic|pso1|kashtan)/i },
  { category: "Accessoires d'armes", subcategory: "Silencieux", pattern: /(suppressor|silencer|compensator|muzzle)/i },
  { category: "Accessoires d'armes", subcategory: "Pièces et accessoires", pattern: /(gunstock|handguard|buttstock|weaponlight|bipod|bayonet|foregrip|weaponrail)/i },

  { category: "Explosifs", subcategory: "Grenades et charges", pattern: /(grenade|landmine|claymore|explosive|plasticexplosive|detonator|tripwire|(^|_)c4($|_)|(^|_)ied($|_))/i },

  { category: "Véhicules", subcategory: "Roues", pattern: /(wheel|tire|tyre)/i },
  { category: "Véhicules", subcategory: "Pièces moteur", pattern: /(radiator|sparkplug|glowplug|carbattery|truckbattery|engine|alternator|carburetor|gearbox|fueltank)/i },
  { category: "Véhicules", subcategory: "Carrosserie", pattern: /(cardoor|vehicledoor|carhood|cartrunk|bumper|fender|windshield)/i },
  { category: "Véhicules", subcategory: "Véhicules", pattern: /(^|_)(vehicle|car|truck|boat|helicopter|aircraft|motorcycle|bike|quad)($|_)|(olga|sarka|ada4x4|gunter|m3s|hummer|landrover|ural|kamaz)/i },

  { category: "Médical", subcategory: "Médicaments", pattern: /(antibiotic|tetracycline|painkiller|charcoaltablets|vitamin|epinephrine|morphine|antidote|medicalpill)/i },
  { category: "Médical", subcategory: "Poches et perfusions", pattern: /(saline|bloodbag|ivstartkit|bloodtestkit|bloodcollection|plasmabag)/i },
  { category: "Médical", subcategory: "Soins", pattern: /(medical|bandage|firstaid|first_aid|syringe|thermometer|defibrillator|splint|disinfect|alcoholtincture)/i },

  { category: "Nourriture", subcategory: "Viandes et poissons", pattern: /(meat|steak|fillet|fish|carp|mackerel|sardine|chickenbreast|goatsteak|beefsteak|porksteak|venison)/i },
  { category: "Nourriture", subcategory: "Conserves", pattern: /(canned|foodcan|can_?(beans|peaches|sardines|tuna|pork|spaghetti))/i },
  { category: "Nourriture", subcategory: "Fruits et légumes", pattern: /(apple|pear|plum|potato|tomato|pepper|pumpkin|zucchini|mushroom|berry|banana|orange|carrot)/i },
  { category: "Nourriture", subcategory: "Aliments", pattern: /(^|_)(food|rice|cereal|powderedmilk|honey|jam|chocolate|biscuit|cracker|bread)($|_)/i },
  { category: "Boissons", subcategory: "Eau et contenants", pattern: /(canteen|waterbottle|water_bottle|waterskin)/i },
  { category: "Boissons", subcategory: "Boissons", pattern: /(^|_)(drink|soda|cola|kvass|juice|energy|coffee|tea|beer|vodka|whisky|wine)($|_)/i },

  { category: "Vêtements", subcategory: "Sacs", pattern: /(backpack|rucksack|drybag|courierbag|taloonbag|mountainbag|assaultbag|waistbag)/i },
  { category: "Vêtements", subcategory: "Casques et chapeaux", pattern: /(helmet|headgear|hat($|_)|cap($|_)|beanie|balaclava|ushanka|boonie|beret|bandana|gasmask)/i },
  { category: "Vêtements", subcategory: "Gilets et protections", pattern: /(platecarrier|ballisticvest|pressvest|stabvest|tacticalvest|chestholster|armor|armour)/i },
  { category: "Vêtements", subcategory: "Chaussures", pattern: /(boots|shoes|sneakers|wellies|moccasins)/i },
  { category: "Vêtements", subcategory: "Mains", pattern: /(gloves|gauntlet)/i },
  { category: "Vêtements", subcategory: "Pantalons", pattern: /(pants|trousers|jeans|shorts|skirt)/i },
  { category: "Vêtements", subcategory: "Vestes et hauts", pattern: /(jacket|shirt|hoodie|sweater|tshirt|coat|parka|blouse|jersey|suit)/i },

  { category: "Conteneurs", subcategory: "Sacs et pochettes", pattern: /(^|_)(bag|pouch)($|_)/i },
  { category: "Conteneurs", subcategory: "Stockage", pattern: /(crate|chest|locker|storage|container|barrel|safe|cabinet|wardrobe|shelter|tent)/i },

  { category: "Construction", subcategory: "Matériaux", pattern: /(plank|nail|sheetmetal|metalplate|woodenlog|lumber|cement|concrete|brick|barbedwire|wiremesh)/i },
  { category: "Construction", subcategory: "Structures", pattern: /(fence|watchtower|territory|flagpole|foundation|wallkit|floorkit|roofkit|doorway|gatekit|workbench)/i },

  { category: "Outils", subcategory: "Couteaux", pattern: /(knife|cleaver|scalpel)/i },
  { category: "Outils", subcategory: "Outils de coupe", pattern: /(hatchet|firefighteraxe|woodaxe|handsaw|hacksaw|chainsaw)/i },
  { category: "Outils", subcategory: "Outils", pattern: /(hammer|pliers|screwdriver|wrench|shovel|pickaxe|hoe|crowbar|lockpick|canopener|compass|binoculars|rangefinder|fishingrod)/i },

  { category: "Électronique", subcategory: "Éclairage", pattern: /(flashlight|headtorch|spotlight|chemlight|lamp|lantern)/i },
  { category: "Électronique", subcategory: "Énergie", pattern: /(battery|powerbank|generator|cable|extensioncord|charger|solar)/i },
  { category: "Électronique", subcategory: "Communication", pattern: /(radio|transmitter|walkietalkie|gps|tablet|phone)/i },

  { category: "Agriculture", subcategory: "Graines et plantes", pattern: /(seed|seeds|plantmaterial|cannabis|tobacco|hemp|pepperseeds|tomatoseeds|pumpkinseeds)/i },
  { category: "Chasse et pêche", subcategory: "Pêche", pattern: /(fishing|hook|bait|netting|fishtrap)/i },
  { category: "Chasse et pêche", subcategory: "Chasse", pattern: /(pelt|hide|fur|antlers|beartrap|snaretrap)/i },

  { category: "Clés", subcategory: "Clés et cartes", pattern: /(^|_)(key|keycard|key_card|accesscard|access_card)($|_)/i },
  { category: "Livres et documents", subcategory: "Documents", pattern: /(book|note|paper|document|map|photo|newspaper)/i },
  { category: "Consommables", subcategory: "Tabac", pattern: /(cigarette|cigar|rollingpapers|tobacco)/i },
  { category: "Objets spéciaux", subcategory: "Monnaies et valeurs", pattern: /(currency|money|rouble|ruble|coin|goldbar|silverbar|diamond|gem)/i },
  { category: "Objets spéciaux", subcategory: "Événement et récompense", pattern: /(event|quest|reward|battlepass|battle_pass|token|voucher|gift|present)/i }
];

function classifyClassname(classname) {
  const value = String(classname || "");
  const rule = CATEGORY_RULES.find((entry) => entry.pattern.test(value));
  return rule ? { category: rule.category, subcategory: rule.subcategory } : null;
}

async function autoClassifyItems({ batchSize = 250 } = {}) {
  const supabase = getSupabaseClient();
  const safeBatchSize = Math.min(Math.max(Number(batchSize) || 250, 1), 500);
  const scanPageSize = 1000;
  const candidates = [];
  let scanned = 0;
  let offset = 0;

  // Parcourt tous les objets encore non classés afin de ne pas rester bloqué
  // sur les premiers classnames qu'aucune règle ne reconnaît.
  while (candidates.length < safeBatchSize) {
    const { data, error } = await supabase
      .from("items")
      .select("id,classname,category,subcategory")
      .eq("is_active", true)
      .in("category", ["Autre", "Non classé"])
      .order("classname", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + scanPageSize - 1);

    if (error) throw error;

    const rows = data || [];
    scanned += rows.length;

    for (const row of rows) {
      const classification = classifyClassname(row.classname);
      if (!classification) continue;

      candidates.push({ row, classification });
      if (candidates.length >= safeBatchSize) break;
    }

    if (rows.length < scanPageSize) break;
    offset += scanPageSize;
  }

  let updated = 0;
  const now = new Date().toISOString();

  for (const { row, classification } of candidates) {
    const { data: changed, error: updateError } = await supabase
      .from("items")
      .update({
        category: classification.category,
        subcategory: row.subcategory || classification.subcategory,
        updated_at: now
      })
      .eq("id", row.id)
      .in("category", ["Autre", "Non classé"])
      .select("id");

    if (updateError) throw updateError;
    if (changed && changed.length) updated += 1;
  }

  const { count, error: countError } = await supabase
    .from("items")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true)
    .in("category", ["Autre", "Non classé"]);

  if (countError) throw countError;

  return {
    processed: scanned,
    updated,
    skipped: Math.max(scanned - candidates.length, 0),
    remaining: Number(count) || 0
  };
}

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
  imageStatus = "",
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

  const allowedImageStatuses = new Set(["found", "pending", "not_found", "error"]);
  if (allowedImageStatuses.has(imageStatus)) {
    request = request.eq("image_status", imageStatus);
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


function cleanText(value, label, maxLength, { allowEmpty = true } = {}) {
  const text = String(value ?? "").trim();

  if (!allowEmpty && !text) {
    throw new Error(`${label} obligatoire.`);
  }

  if (text.length > maxLength) {
    throw new Error(`${label} trop long (${maxLength} caractères maximum).`);
  }

  return text || null;
}

function cleanBoolean(value) {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === 1 || value === "1") return true;
  if (value === "false" || value === 0 || value === "0") return false;
  return undefined;
}

function cleanImageUrl(value) {
  const imageUrl = cleanText(value, "URL de l'image", 1000);
  if (!imageUrl) return null;

  let parsed;
  try {
    parsed = new URL(imageUrl);
  } catch {
    throw new Error("URL de l'image invalide.");
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("URL de l'image invalide.");
  }

  return parsed.toString();
}

async function updateItem(id, payload = {}) {
  const supabase = getSupabaseClient();
  const update = {};

  if (Object.prototype.hasOwnProperty.call(payload, "displayName")) {
    update.display_name = cleanText(payload.displayName, "Nom affiché", 160);
  }
  if (Object.prototype.hasOwnProperty.call(payload, "category")) {
    update.category = cleanText(payload.category, "Catégorie", 100, { allowEmpty: false });
  }
  if (Object.prototype.hasOwnProperty.call(payload, "subcategory")) {
    update.subcategory = cleanText(payload.subcategory, "Sous-catégorie", 100);
  }
  if (Object.prototype.hasOwnProperty.call(payload, "modName")) {
    update.mod_name = cleanText(payload.modName, "Nom du mod", 160, { allowEmpty: false });
  }
  if (Object.prototype.hasOwnProperty.call(payload, "imageUrl")) {
    update.image_url = cleanImageUrl(payload.imageUrl);
    update.image_status = update.image_url ? "found" : "pending";
    update.image_checked_at = null;
  }

  const booleanFields = {
    active: "is_active",
    deliveryEnabled: "delivery_enabled",
    shopEnabled: "shop_enabled",
    battlePassEnabled: "battle_pass_enabled",
    rewardEnabled: "reward_enabled"
  };

  for (const [inputName, columnName] of Object.entries(booleanFields)) {
    if (!Object.prototype.hasOwnProperty.call(payload, inputName)) continue;
    const value = cleanBoolean(payload[inputName]);
    if (value !== undefined) update[columnName] = value;
  }

  if (!Object.keys(update).length) {
    throw new Error("Aucun champ valide à modifier.");
  }

  update.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("items")
    .update(update)
    .eq("id", id)
    .select(
      "id,classname,display_name,category,subcategory,mod_name,source_file,source_path,is_active,delivery_enabled,shop_enabled,battle_pass_enabled,reward_enabled,image_url,image_status,first_seen_at,last_seen_at,updated_at"
    )
    .single();

  if (error) throw error;
  return normalizeItem(data);
}

module.exports = {
  searchItems,
  getItemStats,
  updateItem,
  upsertImportedItems,
  autoClassifyItems
};
