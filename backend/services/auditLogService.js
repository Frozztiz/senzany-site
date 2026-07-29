const { createClient } = require("@supabase/supabase-js");

function getSupabaseClient() {
  const url = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const key = String(process.env.SUPABASE_SECRET_KEY || "");

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

function cleanText(value, maxLength = 500) {
  const text = String(value || "").trim();
  return text ? text.slice(0, maxLength) : null;
}

async function writeAuditLog({
  actorSteamId = null,
  actorName = null,
  action,
  entityType,
  entityId = null,
  success = true,
  details = {},
  ipAddress = null,
  userAgent = null
}) {
  if (!action || !entityType) {
    throw new Error("action et entityType sont obligatoires pour un journal d’audit.");
  }

  const supabase = getSupabaseClient();

  const payload = {
    actor_steam_id: /^\d{17}$/.test(String(actorSteamId || ""))
      ? String(actorSteamId)
      : null,
    actor_name: cleanText(actorName, 150),
    action: cleanText(action, 150),
    entity_type: cleanText(entityType, 100),
    entity_id: cleanText(entityId, 150),
    success: Boolean(success),
    details: details && typeof details === "object" ? details : {},
    ip_address: cleanText(ipAddress, 100),
    user_agent: cleanText(userAgent, 1000)
  };

  const { error } = await supabase
    .from("audit_logs")
    .insert(payload);

  if (error) {
    throw error;
  }
}

async function writeAuditLogSafely(payload) {
  try {
    await writeAuditLog(payload);
  } catch (error) {
    console.error("[AUDIT LOG] Impossible d’enregistrer l’action :", error);
  }
}

module.exports = {
  writeAuditLog,
  writeAuditLogSafely
};
