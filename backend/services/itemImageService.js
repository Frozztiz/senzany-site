const { createClient } = require("@supabase/supabase-js");

const DAYZ_WIKI_API = "https://dayz.fandom.com/api.php";
const USER_AGENT = "SenzanyItemImageBot/1.0";

function getSupabaseClient() {
  const url = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL ou SUPABASE_SECRET_KEY manquante.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function readableClassname(classname) {
  return String(classname || "")
    .replace(/_/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .trim();
}

async function wikiRequest(searchTerm) {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    generator: "search",
    gsrsearch: searchTerm,
    gsrnamespace: "0",
    gsrlimit: "6",
    prop: "pageimages|info",
    piprop: "original|thumbnail",
    pithumbsize: "512",
    inprop: "url",
    origin: "*"
  });

  const response = await fetch(`${DAYZ_WIKI_API}?${params.toString()}`, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(15000)
  });

  if (!response.ok) throw new Error(`Wiki DayZ HTTP ${response.status}`);
  return response.json();
}

function pickBestMatch(classname, payload) {
  const pages = Object.values(payload?.query?.pages || {});
  const target = normalize(classname);
  const readable = normalize(readableClassname(classname));

  const ranked = pages
    .map((page) => {
      const title = String(page.title || "");
      const titleNorm = normalize(title);
      const imageUrl = page?.original?.source || page?.thumbnail?.source || "";
      if (!imageUrl) return null;

      let score = 0;
      if (titleNorm === target) score += 120;
      if (titleNorm === readable) score += 110;
      if (target && (titleNorm.includes(target) || target.includes(titleNorm))) score += 55;
      if (readable && (titleNorm.includes(readable) || readable.includes(titleNorm))) score += 45;

      // Évite d'associer une image sans rapport à un objet moddé.
      if (score < 45) return null;

      return {
        score,
        title,
        imageUrl,
        pageUrl: page.fullurl || ""
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);

  return ranked[0] || null;
}

async function findPublicImage(classname) {
  const attempts = [`\"${classname}\"`, readableClassname(classname)];
  for (const term of attempts) {
    const payload = await wikiRequest(term);
    const match = pickBestMatch(classname, payload);
    if (match) return match;
  }
  return null;
}

async function getImageStats() {
  const supabase = getSupabaseClient();
  const statuses = ["found", "not_found", "error"];
  const results = await Promise.all([
    supabase.from("items").select("id", { count: "exact", head: true }).eq("is_active", true),
    ...statuses.map((status) => supabase.from("items").select("id", { count: "exact", head: true }).eq("is_active", true).eq("image_status", status))
  ]);

  for (const result of results) if (result.error) throw result.error;
  const total = Number(results[0].count) || 0;
  const found = Number(results[1].count) || 0;
  const notFound = Number(results[2].count) || 0;
  const errors = Number(results[3].count) || 0;
  return { total, found, notFound, errors, pending: Math.max(total - found - notFound - errors, 0) };
}

async function processImageBatch({ batchSize = 20, retryMissing = false } = {}) {
  const supabase = getSupabaseClient();
  const safeBatch = Math.min(Math.max(Number(batchSize) || 20, 1), 40);

  let request = supabase
    .from("items")
    .select("id,classname,image_status")
    .eq("is_active", true)
    .order("classname", { ascending: true })
    .limit(safeBatch);

  request = retryMissing
    ? request.in("image_status", ["not_found", "error"])
    : request.is("image_status", null);

  const { data: items, error } = await request;
  if (error) throw error;

  const results = [];
  for (const item of items || []) {
    const checkedAt = new Date().toISOString();
    try {
      const match = await findPublicImage(item.classname);
      const update = match
        ? {
            image_url: match.imageUrl,
            image_source: match.pageUrl || "dayz.fandom.com",
            image_status: "found",
            image_checked_at: checkedAt,
            image_error: null
          }
        : {
            image_url: null,
            image_source: null,
            image_status: "not_found",
            image_checked_at: checkedAt,
            image_error: null
          };

      const { error: updateError } = await supabase.from("items").update(update).eq("id", item.id);
      if (updateError) throw updateError;
      results.push({ classname: item.classname, status: update.image_status, imageUrl: update.image_url });
    } catch (itemError) {
      const message = String(itemError?.message || itemError).slice(0, 500);
      await supabase.from("items").update({
        image_status: "error",
        image_checked_at: checkedAt,
        image_error: message
      }).eq("id", item.id);
      results.push({ classname: item.classname, status: "error", error: message });
    }
  }

  return { processed: results.length, results, stats: await getImageStats() };
}

async function resetImageSearch({ onlyMissing = true } = {}) {
  const supabase = getSupabaseClient();
  let request = supabase.from("items").update({
    image_status: null,
    image_checked_at: null,
    image_error: null
  }).eq("is_active", true);

  if (onlyMissing) request = request.in("image_status", ["not_found", "error"]);
  const { error } = await request;
  if (error) throw error;
  return getImageStats();
}

module.exports = { getImageStats, processImageBatch, resetImageSearch };
