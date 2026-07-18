const express = require("express");
const cookieParser = require("cookie-parser");
require("dotenv").config();

const topServeursRouter = require("./routes/topserveurs");

const app = express();
const PORT = process.env.PORT || 3000;

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

app.use("/api/topserveurs", topServeursRouter);

app.use((req, res) => {
  res.status(404).json({ ok: false, error: "Route introuvable" });
});

app.listen(PORT, "127.0.0.1", () => {
  console.log(`Senzany API lancée sur http://127.0.0.1:${PORT}`);
});
