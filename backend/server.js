const express = require("express");
const cookieParser = require("cookie-parser");
require("dotenv").config();

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "Senzany API",
    timestamp: new Date().toISOString()
  });
});

app.use("/api/topserveurs", require("./routes/topserveurs"));
app.use("/api/discord", require("./routes/discord"));
app.use("/api/game", require("./routes/game"));
app.use("/api/steam", require("./routes/steam"));
app.use(
  "/api/admin/deliveries",
  require("./routes/adminDeliveries")
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
});