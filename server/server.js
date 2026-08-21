const express = require("express");
const cookieParser = require("cookie-parser");
require("dotenv").config();

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());


// Présence web anonyme : un identifiant temporaire par navigateur.
// Aucune IP ni donnée personnelle n'est conservée.
const PRESENCE_TTL_MS = 60 * 1000;
const presenceVisitors = new Map();

function cleanupPresence() {
  const cutoff = Date.now() - PRESENCE_TTL_MS;

  for (const [visitorId, lastSeen] of presenceVisitors.entries()) {
    if (lastSeen < cutoff) {
      presenceVisitors.delete(visitorId);
    }
  }
}

app.post("/api/presence/ping", (req, res) => {
  const visitorId = String(req.body?.visitorId || "").trim();

  if (!/^[a-zA-Z0-9_-]{16,80}$/.test(visitorId)) {
    return res.status(400).json({
      error: "Identifiant de présence invalide.",
    });
  }

  cleanupPresence();
  presenceVisitors.set(visitorId, Date.now());

  res.set("Cache-Control", "no-store");
  res.json({
    ok: true,
    online: presenceVisitors.size,
    ttlSeconds: Math.floor(PRESENCE_TTL_MS / 1000),
  });
});

app.get("/api/presence", (req, res) => {
  cleanupPresence();

  res.set("Cache-Control", "no-store");
  res.json({
    ok: true,
    online: presenceVisitors.size,
  });
});

setInterval(cleanupPresence, 30 * 1000).unref();

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "Senzany API",
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/topserveurs", require("./routes/topserveurs"));
app.use("/api/discord", require("./routes/discord"));
app.use("/api/game", require("./routes/game"));

const PORT = process.env.PORT || 3000;

app.listen(PORT, "127.0.0.1", () => {
  console.log(`Senzany API démarrée sur le port ${PORT}`);
});