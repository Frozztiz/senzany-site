const supabaseService = require("./supabaseService");

const MAX_ALIASES_PER_PLAYER = 20;
const MIN_ALIAS_LENGTH = 2;
const MAX_ALIAS_LENGTH = 50;

function cleanAlias(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeAlias(value) {
  return cleanAlias(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
}

function validateAlias(value) {
  const alias = cleanAlias(value);
  const normalizedAlias = normalizeAlias(alias);

  if (alias.length < MIN_ALIAS_LENGTH || alias.length > MAX_ALIAS_LENGTH) {
    const error = new Error(
      `Le pseudo doit contenir entre ${MIN_ALIAS_LENGTH} et ${MAX_ALIAS_LENGTH} caractères.`
    );
    error.code = "INVALID_ALIAS_LENGTH";
    throw error;
  }

  if (!normalizedAlias) {
    const error = new Error("Le pseudo doit contenir au moins une lettre ou un chiffre.");
    error.code = "INVALID_ALIAS";
    throw error;
  }

  return { alias, normalizedAlias };
}

function mapAlias(row) {
  return {
    id: row.id,
    alias: row.alias,
    createdAt: row.created_at,
  };
}

async function listBySteamId(steamId) {
  const rows = await supabaseService.request(
    `topserveurs_vote_aliases?steam_id=eq.${encodeURIComponent(steamId)}` +
      `&select=id,alias,created_at&order=created_at.asc`,
    { method: "GET" }
  );

  return Array.isArray(rows) ? rows.map(mapAlias) : [];
}

async function listAll() {
  const rows = await supabaseService.request(
    "topserveurs_vote_aliases?select=id,steam_id,alias,normalized_alias,created_at&order=created_at.asc",
    { method: "GET" }
  );

  return Array.isArray(rows) ? rows.map((row) => ({
    id: row.id,
    steamId: String(row.steam_id || ""),
    alias: row.alias,
    normalizedAlias: row.normalized_alias,
    createdAt: row.created_at,
  })) : [];
}

async function findByNormalizedAlias(normalizedAlias) {
  const rows = await supabaseService.request(
    `topserveurs_vote_aliases?normalized_alias=eq.${encodeURIComponent(normalizedAlias)}` +
      `&select=id,steam_id,alias&limit=1`,
    { method: "GET" }
  );

  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

async function addForSteamId(steamId, value) {
  const { alias, normalizedAlias } = validateAlias(value);
  const currentAliases = await listBySteamId(steamId);

  if (currentAliases.length >= MAX_ALIASES_PER_PLAYER) {
    const error = new Error(`Tu peux enregistrer jusqu’à ${MAX_ALIASES_PER_PLAYER} pseudos.`);
    error.code = "ALIAS_LIMIT_REACHED";
    throw error;
  }

  // Contrôle applicatif : un pseudo normalisé ne peut appartenir qu’à un seul compte.
  // Ex. Frozzz, FROZZZ et "Fro zzz" sont considérés comme le même pseudo.
  const existingAlias = await findByNormalizedAlias(normalizedAlias);
  if (existingAlias) {
    const belongsToCurrentAccount = String(existingAlias.steam_id) === String(steamId);
    const conflict = new Error(
      belongsToCurrentAccount
        ? "Ce pseudo est déjà présent dans ta liste."
        : "Ce pseudo est déjà associé à un autre compte Senzany. Contacte un administrateur s’il t’appartient."
    );
    conflict.code = belongsToCurrentAccount ? "ALIAS_ALREADY_OWNED" : "ALIAS_ALREADY_USED";
    throw conflict;
  }

  try {
    const rows = await supabaseService.request("topserveurs_vote_aliases", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        steam_id: steamId,
        alias,
        normalized_alias: normalizedAlias,
      }),
    });

    const row = Array.isArray(rows) ? rows[0] : rows;
    return mapAlias(row);
  } catch (error) {
    // Dernière protection contre deux ajouts simultanés : la contrainte UNIQUE
    // Supabase reste la source de vérité, même si l’API est appelée directement.
    if (error.status === 409 || error.data?.code === "23505") {
      const conflict = new Error(
        "Ce pseudo est déjà associé à un compte Senzany. Contacte un administrateur s’il t’appartient."
      );
      conflict.code = "ALIAS_ALREADY_USED";
      throw conflict;
    }
    throw error;
  }
}

async function removeForSteamId(steamId, aliasId) {
  if (!/^[0-9a-f-]{36}$/i.test(String(aliasId || ""))) {
    const error = new Error("Identifiant de pseudo invalide.");
    error.code = "INVALID_ALIAS_ID";
    throw error;
  }

  const rows = await supabaseService.request(
    `topserveurs_vote_aliases?id=eq.${encodeURIComponent(aliasId)}` +
      `&steam_id=eq.${encodeURIComponent(steamId)}` +
      `&select=id`,
    { method: "GET" }
  );

  if (!Array.isArray(rows) || rows.length === 0) {
    const error = new Error("Pseudo introuvable.");
    error.code = "ALIAS_NOT_FOUND";
    throw error;
  }

  await supabaseService.request(
    `topserveurs_vote_aliases?id=eq.${encodeURIComponent(aliasId)}` +
      `&steam_id=eq.${encodeURIComponent(steamId)}`,
    { method: "DELETE", headers: { Prefer: "return=minimal" } }
  );
}

module.exports = {
  MAX_ALIASES_PER_PLAYER,
  cleanAlias,
  normalizeAlias,
  listBySteamId,
  listAll,
  findByNormalizedAlias,
  addForSteamId,
  removeForSteamId,
};
