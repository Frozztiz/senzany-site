const supabaseService = require("./supabaseService");

const TABLE = "rcon_player_sessions";
const RESTORE_WINDOW_MS = Number.parseInt(
  process.env.RCON_SESSION_RESTORE_WINDOW_MS || "600000",
  10
);

function normalizeKey(value) {
  return String(value || "").trim().toLowerCase();
}

function toDateMs(value) {
  const timestamp = Date.parse(value || "");
  return Number.isFinite(timestamp) ? timestamp : 0;
}

async function loadRecentOnlineSessions() {
  const cutoff = new Date(Date.now() - RESTORE_WINDOW_MS).toISOString();
  const path =
    `${TABLE}?select=session_key,battleye_guid,player_name,connected_at,last_seen_at,is_online` +
    `&is_online=eq.true&last_seen_at=gte.${encodeURIComponent(cutoff)}&limit=1000`;

  const rows = await supabaseService.request(path, { method: "GET" });
  return Array.isArray(rows) ? rows : [];
}

async function upsertSessions(sessions) {
  if (!Array.isArray(sessions) || sessions.length === 0) return;

  await supabaseService.request(`${TABLE}?on_conflict=session_key`, {
    method: "POST",
    headers: {
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(sessions),
  });
}

async function markOffline(sessionKeys, disconnectedAt = new Date().toISOString()) {
  const keys = [...new Set((sessionKeys || []).map(normalizeKey).filter(Boolean))];
  if (keys.length === 0) return;

  const encoded = keys.map((key) => `"${key.replace(/"/g, "")}"`).join(",");
  await supabaseService.request(`${TABLE}?session_key=in.(${encodeURIComponent(encoded)})`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      is_online: false,
      disconnected_at: disconnectedAt,
      updated_at: disconnectedAt,
    }),
  });
}

function rowToSession(row) {
  return {
    connectedAt: toDateMs(row.connected_at),
    lastSeenAt: toDateMs(row.last_seen_at),
    playerName: row.player_name || null,
    guid: row.battleye_guid || null,
  };
}

module.exports = {
  loadRecentOnlineSessions,
  upsertSessions,
  markOffline,
  rowToSession,
};
