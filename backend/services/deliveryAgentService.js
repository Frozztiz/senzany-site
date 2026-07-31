const { createClient } = require("@supabase/supabase-js");

function getSupabaseClient() {
  const url = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const key = String(process.env.SUPABASE_SECRET_KEY || "");

  if (!url || !key) {
    throw new Error("SUPABASE_URL ou SUPABASE_SECRET_KEY manquante.");
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

async function countPendingDeliveries({ steamId, agentId }) {
  // agentId est conservé dans la signature pour journalisation et évolution future.
  void agentId;

  const supabase = getSupabaseClient();
  const { count, error } = await supabase
    .from("deliveries")
    .select("id", { count: "exact", head: true })
    .eq("steam_id", steamId)
    .eq("status", "pending");

  if (error) throw error;
  return Number(count || 0);
}

async function claimNextDelivery({ steamId, agentId }) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("claim_next_delivery", {
    p_steam_id: steamId,
    p_agent_id: agentId
  });

  if (error) throw error;
  return data || null;
}

async function completeDelivery({ deliveryId, claimToken, success, errorMessage }) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("complete_claimed_delivery", {
    p_delivery_id: deliveryId,
    p_claim_token: claimToken,
    p_success: Boolean(success),
    p_error_message: errorMessage || null
  });

  if (error) throw error;
  return data || null;
}

module.exports = {
  countPendingDeliveries,
  claimNextDelivery,
  completeDelivery
};
