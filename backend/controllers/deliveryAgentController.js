const deliveryAgentService = require("../services/deliveryAgentService");

function cleanString(value, maxLength = 250) {
  return String(value || "")
    .trim()
    .slice(0, maxLength);
}

function parseBoolean(value) {
  if (value === true) {
    return true;
  }

  if (value === false) {
    return false;
  }

  if (value === 1 || value === "1") {
    return true;
  }

  if (value === 0 || value === "0") {
    return false;
  }

  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  return normalized === "true" ||
    normalized === "yes" ||
    normalized === "oui";
}

exports.health = (req, res) => {
  res.set("Cache-Control", "no-store");

  res.json({
    ok: true,
    service: "Senzany Delivery Agent API"
  });
};

exports.check = async (req, res) => {
  res.set("Cache-Control", "no-store");

  try {
    const steamId = cleanString(req.body?.steamId, 17);
    const agentId = cleanString(req.body?.agentId || "dayz-server", 100);

    if (!/^\d{17}$/.test(steamId)) {
      return res.status(400).json({
        error: "steamId doit contenir exactement 17 chiffres."
      });
    }

    const count = await deliveryAgentService.countPendingDeliveries({
      steamId,
      agentId
    });

    return res.json({
      available: count > 0,
      count
    });
  } catch (error) {
    console.error("Vérification des livraisons :", error);

    return res.status(500).json({
      error: "Impossible de vérifier les livraisons en attente."
    });
  }
};

exports.claim = async (req, res) => {
  res.set("Cache-Control", "no-store");

  try {
    const steamId = cleanString(
      req.body?.steamId,
      17
    );

    const agentId = cleanString(
      req.body?.agentId || "dayz-server",
      100
    );

    if (!/^\d{17}$/.test(steamId)) {
      return res.status(400).json({
        error: "steamId doit contenir exactement 17 chiffres."
      });
    }

    const delivery =
      await deliveryAgentService.claimNextDelivery({
        steamId,
        agentId
      });

    return res.json({
      delivery
    });
  } catch (error) {
    console.error(
      "Réclamation d'une livraison :",
      error
    );

    return res.status(500).json({
      error: "Impossible de récupérer la prochaine livraison."
    });
  }
};

exports.complete = async (req, res) => {
  res.set("Cache-Control", "no-store");

  try {
    const deliveryId = cleanString(
      req.body?.deliveryId,
      100
    );

    const claimToken = cleanString(
      req.body?.claimToken,
      100
    );

    const success = parseBoolean(
      req.body?.success
    );

    const errorMessage = cleanString(
      req.body?.errorMessage,
      1000
    );

    console.log(
      "[DELIVERY COMPLETE]",
      {
        deliveryId,
        rawSuccess: req.body?.success,
        parsedSuccess: success
      }
    );

    if (!deliveryId || !claimToken) {
      return res.status(400).json({
        error: "deliveryId et claimToken sont obligatoires."
      });
    }

    const delivery =
      await deliveryAgentService.completeDelivery({
        deliveryId,
        claimToken,
        success,
        errorMessage
      });

    if (!delivery) {
      return res.status(409).json({
        error: "Livraison introuvable, déjà terminée ou jeton invalide."
      });
    }

    return res.json({
      delivery
    });
  } catch (error) {
    console.error(
      "Confirmation d'une livraison :",
      error
    );

    return res.status(500).json({
      error: "Impossible de confirmer la livraison."
    });
  }
};