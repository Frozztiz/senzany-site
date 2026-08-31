const express = require("express");
const cookieParser = require("cookie-parser");
require("dotenv").config();

const app = express();

const localDevEnabled = process.env.SENZANY_LOCAL_DEV === "true";
const localDevOrigins = new Set([
  "http://localhost:8888",
  "http://127.0.0.1:8888",
]);

// Développement local uniquement : autorise le frontend Netlify Dev à lire
// l'API Express locale. Cette branche reste inactive en production.
if (localDevEnabled) {
  app.use((req, res, next) => {
    const origin = String(req.headers.origin || "");

    if (localDevOrigins.has(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Headers", "Accept, Content-Type");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    }

    if (req.method === "OPTIONS") {
      return res.sendStatus(204);
    }

    next();
  });
}

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

app.use(
  "/api/admin/events",
  require("./middleware/commandAuth"),
  require("./routes/adminEvents")
);

app.use(
  "/api/admin/battle-pass",
  require("./middleware/commandAuth"),
  require("./routes/adminBattlePass")
);

app.use("/api/battle-pass", require("./routes/battlePass"));

app.use("/api/map/requests", require("./routes/mapRequests"));
app.use("/api/map", require("./routes/mapPublic"));

app.use(
  "/api/admin/map",
  require("./middleware/commandAuth"),
  require("./routes/adminMap")
);

app.use((req, res) => {
  res.status(404).json({
    error: "Route API introuvable."
  });
});

app.use((error, req, res, next) => {
  console.error("Erreur API Senzany :", error);

  res.status(500).json({
    error: "Erreur interne du serveur."
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, "127.0.0.1", () => {
  console.log(`Senzany API démarrée sur le port ${PORT}`);

  if (localDevEnabled) {
    console.log("[LOCAL DEV] Mode lecture seule actif — scheduler mensuel désactivé.");
    return;
  }

  require("./services/monthlyVoteRewardService").startScheduler();
});