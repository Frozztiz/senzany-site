const deliveryService = require("../services/deliveryService");

function cleanString(value, maxLength = 500) {
  return String(value || "")
    .trim()
    .slice(0, maxLength);
}

function normalizeItems(items) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map((item) => {
      const className = cleanString(
        item?.className || item?.name || item?.classname,
        150
      );

      const quantity = Number(item?.quantity || item?.qty || 1);

      return {
        className,
        name: className,
        quantity: Number.isFinite(quantity)
          ? Math.max(1, Math.min(999, Math.floor(quantity)))
          : 1
      };
    })
    .filter((item) => item.className);
}

exports.list = async (req, res) => {
  res.set("Cache-Control", "no-store");

  try {
    const status = cleanString(req.query.status, 50);

    const deliveries = await deliveryService.getDeliveries(status);

    return res.json({
      deliveries
    });
  } catch (error) {
    console.error("Liste des livraisons :", error);

    return res.status(500).json({
      error: "Impossible de charger les livraisons."
    });
  }
};

exports.get = async (req, res) => {
  res.set("Cache-Control", "no-store");

  try {
    const id = cleanString(req.params.id, 100);

    const delivery = await deliveryService.getDeliveryById(id);

    if (!delivery) {
      return res.status(404).json({
        error: "Livraison introuvable."
      });
    }

    return res.json(delivery);
  } catch (error) {
    console.error("Lecture de la livraison :", error);

    return res.status(500).json({
      error: "Impossible de charger la livraison."
    });
  }
};

exports.create = async (req, res) => {
  try {
    const steamId = cleanString(req.body?.steamId, 17);
    const playerName = cleanString(req.body?.playerName, 100);
    const title = cleanString(req.body?.title, 150);
    const message = cleanString(req.body?.message, 1000);
    const items = normalizeItems(req.body?.items);

    if (!/^\d{17}$/.test(steamId)) {
      return res.status(400).json({
        error: "Le SteamID64 doit contenir exactement 17 chiffres."
      });
    }

    if (!title) {
      return res.status(400).json({
        error: "Le titre de la livraison est obligatoire."
      });
    }

    if (!items.length) {
      return res.status(400).json({
        error: "Ajoute au moins un objet à la livraison."
      });
    }

    const delivery = await deliveryService.createDelivery({
      steamId,
      playerName,
      title,
      message,
      items
    });

    return res.status(201).json(delivery);
  } catch (error) {
    console.error("Création de la livraison :", error);

    return res.status(500).json({
      error: "Impossible de créer la livraison."
    });
  }
};

exports.update = async (req, res) => {
  try {
    const id = cleanString(req.params.id, 100);

    const status = cleanString(req.body?.status, 50);
    const message = cleanString(req.body?.message, 1000);

    const allowedStatuses = [
      "pending",
      "claimed",
      "processing",
      "delivered",
      "failed",
      "cancelled"
    ];

    if (status && !allowedStatuses.includes(status)) {
      return res.status(400).json({
        error: "Statut de livraison invalide."
      });
    }

    const delivery = await deliveryService.updateDelivery(id, {
      status,
      message
    });

    if (!delivery) {
      return res.status(404).json({
        error: "Livraison introuvable."
      });
    }

    return res.json(delivery);
  } catch (error) {
    console.error("Mise à jour de la livraison :", error);

    return res.status(500).json({
      error: "Impossible de modifier la livraison."
    });
  }
};

exports.remove = async (req, res) => {
  try {
    const id = cleanString(req.params.id, 100);

    const removed = await deliveryService.deleteDelivery(id);

    if (!removed) {
      return res.status(404).json({
        error: "Livraison introuvable."
      });
    }

    return res.status(204).send();
  } catch (error) {
    console.error("Suppression de la livraison :", error);

    return res.status(500).json({
      error: "Impossible de supprimer la livraison."
    });
  }
};