const supabaseService = require("./supabaseService");

const TABLE = "reward_rules";
const ALLOWED_TYPES = new Set(["votes", "event", "fidelity", "battle_pass", "compensation"]);

function cleanText(value, max = 160) {
  return String(value || "").trim().slice(0, max);
}

function parseInteger(value, fallback = 0) {
  const number = Number.parseInt(value, 10);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeItems(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 100).map((item) => ({
    classname: cleanText(item?.classname, 160),
    quantity: Math.max(1, parseInteger(item?.quantity, 1)),
  })).filter((item) => item.classname);
}

function validatePayload(input = {}) {
  const rewardType = cleanText(input.rewardType || input.reward_type, 40);
  if (!ALLOWED_TYPES.has(rewardType)) {
    const error = new Error("Type de récompense invalide.");
    error.status = 400;
    throw error;
  }

  const rankMin = Math.max(1, parseInteger(input.rankMin ?? input.rank_min, 1));
  const rankMax = Math.max(rankMin, parseInteger(input.rankMax ?? input.rank_max, rankMin));
  const name = cleanText(input.name, 100);
  if (name.length < 2) {
    const error = new Error("Le nom du pack doit contenir au moins 2 caractères.");
    error.status = 400;
    throw error;
  }

  return {
    reward_type: rewardType,
    rank_min: rankMin,
    rank_max: rankMax,
    name,
    description: cleanText(input.description, 500),
    roubles: Math.max(0, parseInteger(input.roubles, 0)),
    battle_pass_xp: Math.max(0, parseInteger(input.battlePassXp ?? input.battle_pass_xp, 0)),
    items: normalizeItems(input.items),
    is_active: input.isActive ?? input.is_active ?? true,
    priority: Math.max(0, parseInteger(input.priority, 100)),
    updated_at: new Date().toISOString(),
  };
}

async function list() {
  const rows = await supabaseService.request(
    `${TABLE}?select=id,reward_type,rank_min,rank_max,name,description,roubles,battle_pass_xp,items,is_active,priority,created_at,updated_at&order=reward_type.asc,rank_min.asc,priority.asc`,
    { method: "GET" }
  );
  return Array.isArray(rows) ? rows : [];
}

async function create(input, actorSteamId) {
  const payload = { ...validatePayload(input), created_by: String(actorSteamId || "") || null };
  const rows = await supabaseService.request(TABLE, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(payload),
  });
  return Array.isArray(rows) ? rows[0] : rows;
}

async function update(id, input, actorSteamId) {
  const payload = { ...validatePayload(input), updated_by: String(actorSteamId || "") || null };
  const rows = await supabaseService.request(`${TABLE}?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(payload),
  });
  if (!Array.isArray(rows) || rows.length === 0) {
    const error = new Error("Règle de récompense introuvable.");
    error.status = 404;
    throw error;
  }
  return rows[0];
}

async function remove(id) {
  await supabaseService.request(`${TABLE}?id=eq.${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" },
  });
}

module.exports = { list, create, update, remove, validatePayload };
