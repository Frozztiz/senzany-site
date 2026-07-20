/**
 * Service de gestion des livraisons Senzany.
 *
 * Toutes les communications avec Supabase passent par le backend
 * avec la clé privée SUPABASE_SECRET_KEY.
 */

function getSupabaseConfig() {
  const url = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const key = String(process.env.SUPABASE_SECRET_KEY || "");

  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL ou SUPABASE_SECRET_KEY est manquante dans le backend."
    );
  }

  return { url, key };
}

/**
 * Effectue une requête vers l'API REST de Supabase.
 */
async function supabaseRequest(path, options = {}) {
  const { url, key } = getSupabaseConfig();

  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const text = await response.text();

  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    const error = new Error(
      data?.message ||
        data?.error_description ||
        `Erreur Supabase HTTP ${response.status}`
    );

    error.status = response.status;
    error.data = data;

    throw error;
  }

  return data;
}

/**
 * Nettoie et contrôle la liste des objets d'une livraison.
 */
function normalizeItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("La livraison doit contenir au moins un objet.");
  }

  if (items.length > 100) {
    throw new Error(
      "Une livraison ne peut pas contenir plus de 100 lignes d'objets."
    );
  }

  return items.map((item, index) => {
    const classname = String(item?.classname || "").trim();
    const displayName = String(item?.displayName || "").trim();

    const quantity = Number(item?.quantity ?? 1);

    if (!classname) {
      throw new Error(
        `Le classname de l'objet numéro ${index + 1} est obligatoire.`
      );
    }

    if (
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > 1000
    ) {
      throw new Error(
        `La quantité de l'objet "${classname}" doit être comprise entre 1 et 1000.`
      );
    }

    const metadata =
      item?.metadata &&
      typeof item.metadata === "object" &&
      !Array.isArray(item.metadata)
        ? item.metadata
        : {};

    return {
      classname,
      display_name: displayName || null,
      quantity,
      metadata,
    };
  });
}

/**
 * Crée une livraison ainsi que les objets qu'elle contient.
 */
async function createDelivery({
  steamId,
  playerName,
  title,
  message,
  items,
  createdBy,
  createdByName,
}) {
  const cleanSteamId = String(steamId || "").trim();
  const cleanPlayerName = String(playerName || "").trim();
  const cleanTitle = String(title || "").trim();
  const cleanMessage = String(message || "").trim();
  const cleanCreatedBy = String(createdBy || "").trim();
  const cleanCreatedByName = String(createdByName || "").trim();

  if (!/^\d{17}$/.test(cleanSteamId)) {
    throw new Error("Le SteamID64 du joueur est invalide.");
  }

  if (!cleanTitle) {
    throw new Error("Le titre de la livraison est obligatoire.");
  }

  if (cleanTitle.length > 150) {
    throw new Error(
      "Le titre de la livraison ne peut pas dépasser 150 caractères."
    );
  }

  const normalizedItems = normalizeItems(items);

  const createdRows = await supabaseRequest("deliveries", {
    method: "POST",
    headers: {
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      steam_id: cleanSteamId,
      player_name: cleanPlayerName || null,
      title: cleanTitle,
      message: cleanMessage || null,
      status: "pending",
      created_by: cleanCreatedBy || null,
      created_by_name: cleanCreatedByName || null,
    }),
  });

  const delivery = Array.isArray(createdRows)
    ? createdRows[0]
    : createdRows;

  if (!delivery?.id) {
    throw new Error(
      "Supabase n'a pas retourné l'identifiant de la livraison."
    );
  }

  const itemPayload = normalizedItems.map((item) => ({
    delivery_id: delivery.id,
    ...item,
  }));

  try {
    await supabaseRequest("delivery_items", {
      method: "POST",
      headers: {
        Prefer: "return=representation",
      },
      body: JSON.stringify(itemPayload),
    });
  } catch (error) {
    /*
     * Si la création des objets échoue, on supprime la livraison
     * principale pour éviter de conserver une livraison vide.
     */
    try {
      await supabaseRequest(
        `deliveries?id=eq.${encodeURIComponent(delivery.id)}`,
        {
          method: "DELETE",
          headers: {
            Prefer: "return=minimal",
          },
        }
      );
    } catch (cleanupError) {
      console.error(
        "Impossible de nettoyer la livraison incomplète :",
        cleanupError
      );
    }

    throw error;
  }

  return getDeliveryById(delivery.id);
}

/**
 * Récupère une livraison avec ses objets.
 */
async function getDeliveryById(deliveryId) {
  const cleanDeliveryId = String(deliveryId || "").trim();

  if (!cleanDeliveryId) {
    throw new Error("L'identifiant de la livraison est obligatoire.");
  }

  const query =
    `deliveries` +
    `?id=eq.${encodeURIComponent(cleanDeliveryId)}` +
    `&select=*,delivery_items(*)` +
    `&limit=1`;

  const rows = await supabaseRequest(query, {
    method: "GET",
  });

  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

/**
 * Récupère les livraisons d'un joueur grâce à son SteamID64.
 */
async function getPlayerDeliveries(steamId) {
  const cleanSteamId = String(steamId || "").trim();

  if (!/^\d{17}$/.test(cleanSteamId)) {
    throw new Error("Le SteamID64 du joueur est invalide.");
  }

  const query =
    `deliveries` +
    `?steam_id=eq.${encodeURIComponent(cleanSteamId)}` +
    `&select=*,delivery_items(*)` +
    `&order=created_at.desc`;

  const rows = await supabaseRequest(query, {
    method: "GET",
  });

  return Array.isArray(rows) ? rows : [];
}

/**
 * Récupère toutes les livraisons pour l'administration.
 */
async function getAllDeliveries({
  status,
  steamId,
  limit = 100,
} = {}) {
  const safeLimit = Math.min(
    Math.max(Number.parseInt(limit, 10) || 100, 1),
    500
  );

  const filters = [
    "select=*,delivery_items(*)",
    "order=created_at.desc",
    `limit=${safeLimit}`,
  ];

  const cleanStatus = String(status || "").trim();
  const cleanSteamId = String(steamId || "").trim();

  if (cleanStatus) {
    filters.push(`status=eq.${encodeURIComponent(cleanStatus)}`);
  }

  if (cleanSteamId) {
    filters.push(`steam_id=eq.${encodeURIComponent(cleanSteamId)}`);
  }

  const rows = await supabaseRequest(
    `deliveries?${filters.join("&")}`,
    {
      method: "GET",
    }
  );

  return Array.isArray(rows) ? rows : [];
}

/**
 * Réclame une livraison.
 *
 * La fonction SQL claim_delivery garantit que :
 * - la livraison appartient au joueur ;
 * - elle est encore en attente ;
 * - elle ne peut être réclamée qu'une seule fois.
 */
async function claimDelivery({ deliveryId, steamId }) {
  const cleanDeliveryId = String(deliveryId || "").trim();
  const cleanSteamId = String(steamId || "").trim();

  if (!cleanDeliveryId) {
    throw new Error("L'identifiant de la livraison est obligatoire.");
  }

  if (!/^\d{17}$/.test(cleanSteamId)) {
    throw new Error("Le SteamID64 du joueur est invalide.");
  }

  try {
    const result = await supabaseRequest("rpc/claim_delivery", {
      method: "POST",
      body: JSON.stringify({
        p_delivery_id: cleanDeliveryId,
        p_steam_id: cleanSteamId,
      }),
    });

    const claimedDelivery = Array.isArray(result)
      ? result[0]
      : result;

    if (!claimedDelivery?.id) {
      throw new Error("La livraison n'a pas pu être réclamée.");
    }

    return getDeliveryById(claimedDelivery.id);
  } catch (error) {
    const supabaseMessage = String(
      error?.data?.message || error?.message || ""
    );

    if (supabaseMessage.includes("DELIVERY_NOT_CLAIMABLE")) {
      const claimError = new Error(
        "Cette livraison n'existe pas, ne t'appartient pas ou a déjà été réclamée."
      );

      claimError.code = "DELIVERY_NOT_CLAIMABLE";
      claimError.status = 409;

      throw claimError;
    }

    throw error;
  }
}

module.exports = {
  createDelivery,
  getDeliveryById,
  getPlayerDeliveries,
  getAllDeliveries,
  claimDelivery,
};