const { createClient } = require("@supabase/supabase-js");

function getSupabaseClient() {
  const url = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const key = process.env.SUPABASE_SECRET_KEY;

  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL ou SUPABASE_SECRET_KEY manquante."
    );
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

function mapItem(row) {
  return {
    id: row.id,
    className: row.classname,
    name: row.display_name || row.classname,
    quantity: row.quantity,
    metadata: row.metadata || {}
  };
}

function mapDelivery(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    steamId: row.steam_id,
    playerName: row.player_name,
    title: row.title,
    message: row.message,
    status: row.status,

    createdBy: row.created_by,
    createdByName: row.created_by_name,

    claimToken: row.claim_token,
    errorMessage: row.error_message,
    retryCount: row.retry_count,

    createdAt: row.created_at,
    claimedAt: row.claimed_at,
    processingAt: row.processing_at,
    deliveredAt: row.delivered_at,
    failedAt: row.failed_at,
    cancelledAt: row.cancelled_at,
    updatedAt: row.updated_at,

    items: Array.isArray(row.delivery_items)
      ? row.delivery_items.map(mapItem)
      : []
  };
}

async function getDeliveries(status = "") {
  const supabase = getSupabaseClient();

  let query = supabase
    .from("deliveries")
    .select(`
      *,
      delivery_items (
        id,
        classname,
        display_name,
        quantity,
        metadata,
        created_at
      )
    `)
    .order("created_at", {
      ascending: false
    });

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return Array.isArray(data)
    ? data.map(mapDelivery)
    : [];
}

async function getDeliveryById(id) {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("deliveries")
    .select(`
      *,
      delivery_items (
        id,
        classname,
        display_name,
        quantity,
        metadata,
        created_at
      )
    `)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return mapDelivery(data);
}

async function createDelivery({
  steamId,
  playerName,
  title,
  message,
  items,
  createdBy = null,
  createdByName = null
}) {
  const supabase = getSupabaseClient();

  /*
   * La livraison est d'abord créée en "processing".
   *
   * L'agent DayZ ne réclame que les livraisons "pending".
   * Cela empêche l'agent de récupérer la livraison avant que
   * tous les objets aient été enregistrés dans delivery_items.
   */
  const { data: delivery, error: deliveryError } = await supabase
    .from("deliveries")
    .insert({
      steam_id: steamId,
      player_name: playerName || null,
      title,
      message: message || null,
      status: "processing",
      processing_at: new Date().toISOString(),
      created_by: createdBy,
      created_by_name: createdByName
    })
    .select("*")
    .single();

  if (deliveryError) {
    throw deliveryError;
  }

  const deliveryItems = items
    .map((item) => {
      const className = String(
        item.className ||
        item.classname ||
        item.name ||
        ""
      ).trim();

      const displayName = String(
        item.name ||
        item.displayName ||
        className
      ).trim();

      const quantity = Math.max(
        1,
        Math.min(
          1000,
          Number(item.quantity) || 1
        )
      );

      return {
        delivery_id: delivery.id,
        classname: className,
        display_name: displayName || className,
        quantity,
        metadata:
          item.metadata &&
          typeof item.metadata === "object"
            ? item.metadata
            : {}
      };
    })
    .filter((item) => item.classname);

  if (!deliveryItems.length) {
    await supabase
      .from("deliveries")
      .delete()
      .eq("id", delivery.id);

    throw new Error(
      "La livraison ne contient aucun objet valide."
    );
  }

  const { error: itemsError } = await supabase
    .from("delivery_items")
    .insert(deliveryItems);

  if (itemsError) {
    await supabase
      .from("deliveries")
      .delete()
      .eq("id", delivery.id);

    throw itemsError;
  }

  /*
   * Les objets sont maintenant tous enregistrés.
   * La livraison peut devenir visible pour l'agent DayZ.
   */
  const { error: activateError } = await supabase
    .from("deliveries")
    .update({
      status: "pending",
      processing_at: null,
      error_message: null,
      updated_at: new Date().toISOString()
    })
    .eq("id", delivery.id)
    .eq("status", "processing");

  if (activateError) {
    await supabase
      .from("deliveries")
      .delete()
      .eq("id", delivery.id);

    throw activateError;
  }

  console.log(
    `[DELIVERY CREATED] ${delivery.id} - ${deliveryItems.length} objet(s) - statut pending`
  );

  return getDeliveryById(delivery.id);
}

async function updateDelivery(id, updates = {}) {
  const supabase = getSupabaseClient();

  const payload = {};

  if (updates.status) {
    payload.status = updates.status;

    const now = new Date().toISOString();

    if (updates.status === "claimed") {
      payload.claimed_at = now;
    }

    if (updates.status === "processing") {
      payload.processing_at = now;
    }

    if (updates.status === "delivered") {
      payload.delivered_at = now;
    }

    if (updates.status === "failed") {
      payload.failed_at = now;
    }

    if (updates.status === "cancelled") {
      payload.cancelled_at = now;
    }
  }

  if (typeof updates.message === "string") {
    payload.message = updates.message || null;
  }

  const { error } = await supabase
    .from("deliveries")
    .update(payload)
    .eq("id", id);

  if (error) {
    throw error;
  }

  return getDeliveryById(id);
}

async function deleteDelivery(id) {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("deliveries")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data);
}

module.exports = {
  getDeliveries,
  getDeliveryById,
  createDelivery,
  updateDelivery,
  deleteDelivery
};