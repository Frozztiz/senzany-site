const express = require("express");
const router = express.Router();

const deliveryController = require("../controllers/deliveryController");
const {
  requireSteamSession,
  requireStaff,
} = require("../middleware/deliveryAuth");

/*
|--------------------------------------------------------------------------
| Joueur
|--------------------------------------------------------------------------
*/

// Liste des livraisons du joueur connecté
router.get(
  "/player",
  requireSteamSession,
  deliveryController.getPlayerDeliveries
);

// Réclamer une livraison
router.post(
  "/:id/claim",
  requireSteamSession,
  deliveryController.claimDelivery
);

/*
|--------------------------------------------------------------------------
| Administration
|--------------------------------------------------------------------------
*/

// Créer une livraison
router.post(
  "/admin",
  requireSteamSession,
  requireStaff,
  deliveryController.createDelivery
);

// Liste des livraisons
router.get(
  "/admin",
  requireSteamSession,
  requireStaff,
  deliveryController.getAllDeliveries
);

module.exports = router;