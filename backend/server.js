const express = require("express");
const cookieParser = require("cookie-parser");
require("dotenv").config();

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use((req, res, next) => {
    const startedAt = Date.now();

    res.on("finish", () => {
        console.log(
            new Date().toISOString(),
            req.method,
            req.url,
            "STATUS:",
            res.statusCode,
            "DUREE:",
            Date.now() - startedAt,
            "ms"
        );
    });

    next();
});

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "Senzany API",
    timestamp: new Date().toISOString()
  });
});

app.use("/api/topserveurs", require("./routes/topserveurs"));
app.use("/api/vote-wallet", require("./routes/voteWallet"));
app.use("/api/discord", require("./routes/discord"));
app.use("/api/game", require("./routes/game"));
app.use("/api/steam", require("./routes/steam"));
app.use("/api/commandement", require("./routes/commandement"));

app.use(
  "/api/rcon",
  require("./middleware/commandAuth"),
  require("./routes/rcon")
);

app.use("/api/delivery-agent", require("./routes/deliveryAgent"));

app.use(
  "/api/admin/deliveries",
  require("./middleware/commandAuth"),
  require("./routes/adminDeliveries")
);

app.use(
  "/api/admin/items",
  require("./middleware/commandAuth"),
  require("./routes/adminItems")
);

app.use(
  "/api/admin/rewards",
  require("./middleware/commandAuth"),
  require("./routes/adminRewards")
);

app.use(
  "/api/admin/monthly-votes",
  require("./middleware/commandAuth"),
  require("./routes/adminMonthlyVotes")
);

// ============================================================
// CARTE SENZANY
// ============================================================

// Route publique.
// Ne retourne aucune donnée privée :
// pas de SteamID, coordonnées admin, propriétaire,
// membres ou commentaires staff.
app.use("/api/map", require("./routes/mapPublic"));

// Route privée Commandement.
// Protection par le middleware Steam/Commandement existant.
app.use(
  "/api/admin/map",
  require("./middleware/commandAuth"),
  require("./routes/adminMap")
);

// ============================================================
// 404
// Toujours conserver ce bloc APRÈS toutes les routes API.
// ============================================================

app.use((req, res) => {
  res.status(404).json({
    error: "Route API introuvable."
  });
});

// ============================================================
// GESTION DES ERREURS
// ============================================================

app.use((error, req, res, next) => {
  console.error("Erreur API Senzany :", error);

  res.status(500).json({
    error: "Erreur interne du serveur."
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, "127.0.0.1", () => {
  console.log(`Senzany API démarrée sur le port ${PORT}`);
  require("./services/monthlyVoteRewardService").startScheduler();
});