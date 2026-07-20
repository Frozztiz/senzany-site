const deliveryService = require("../services/deliveryService");

/**
 * Récupère le SteamID de l'utilisateur connecté.
 *
 * Le middleware Steam existant doit normalement renseigner
 * l'utilisateur dans req.user ou req.steamUser.
 */
function getAuthenticatedSteamId(req) {
  return String(req.steamId || "").trim();
} {
  const steamId =
    req.user?.steamId ||
    req.user?.steam_id ||
    req.steamUser?.steamId ||
    req.steamUser?.steam_id ||
    req.session?.steamId ||
    req.session?.steam_id;

  return String(steamId || "").trim();
}

/**
 * Création d'une livraison par le staff.
 *
 * POST /api/admin/deliveries
 */
async function createDelivery(req, res) {
  try {
    const {
      steamId,
      playerName,
      title,
      message,
      items,
      createdBy,
      createdByName,
    } = req.body || {};

    const delivery = await deliveryService.createDelivery({
      steamId,
      playerName,
      title,
      message,
      items,
      createdBy,
      createdByName,
    });

    return res.status(201).json({
      success: true,
      message: "La livraison a été créée avec succès.",
      delivery,
    });
  } catch (error) {
    console.error("Erreur createDelivery :", error);

    return res.status(error.status || 400).json({
      success: false,
      error: error.message || "Impossible de créer la livraison.",
    });
  }
}

/**
 * Liste toutes les livraisons pour le staff.
 *
 * GET /api/admin/deliveries
 */
async function getAllDeliveries(req, res) {
  try {
    const deliveries = await deliveryService.getAllDeliveries({
      status: req.query.status,
      steamId: req.query.steamId,
      limit: req.query.limit,
    });

    return res.json({
      success: true,
      count: deliveries.length,
      deliveries,
    });
  } catch (error) {
    console.error("Erreur getAllDeliveries :", error);

    return res.status(error.status || 500).json({
      success: false,
      error:
        error.message ||
        "Impossible de récupérer les livraisons administratives.",
    });
  }
}

/**
 * Récupère les livraisons du joueur connecté.
 *
 * GET /api/deliveries/player
 */
async function getPlayerDeliveries(req, res) {
  try {
    const steamId = getAuthenticatedSteamId(req);

    if (!steamId) {
      return res.status(401).json({
        success: false,
        error: "Tu dois être connecté avec Steam.",
      });
    }

    const deliveries =
      await deliveryService.getPlayerDeliveries(steamId);

    return res.json({
      success: true,
      count: deliveries.length,
      deliveries,
    });
  } catch (error) {
    console.error("Erreur getPlayerDeliveries :", error);

    return res.status(error.status || 500).json({
      success: false,
      error:
        error.message ||
        "Impossible de récupérer les livraisons du joueur.",
    });
  }
}

/**
 * Le joueur réclame une livraison.
 *
 * POST /api/deliveries/:id/claim
 */
async function claimDelivery(req, res) {
  try {
    const steamId = getAuthenticatedSteamId(req);
    const deliveryId = String(req.params.id || "").trim();

    if (!steamId) {
      return res.status(401).json({
        success: false,
        error: "Tu dois être connecté avec Steam.",
      });
    }

    if (!deliveryId) {
      return res.status(400).json({
        success: false,
        error: "L'identifiant de la livraison est manquant.",
      });
    }

    const delivery = await deliveryService.claimDelivery({
      deliveryId,
      steamId,
    });

    return res.json({
      success: true,
      message:
        "La livraison a été réclamée. Elle attend maintenant le serveur DayZ.",
      delivery,
    });
  } catch (error) {
    console.error("Erreur claimDelivery :", error);

    return res.status(error.status || 500).json({
      success: false,
      error:
        error.message ||
        "Impossible de réclamer cette livraison.",
    });
  }
}

module.exports = {
  createDelivery,
  getAllDeliveries,
  getPlayerDeliveries,
  claimDelivery,
};