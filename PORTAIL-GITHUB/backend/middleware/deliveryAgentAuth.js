const crypto = require("crypto");

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left || ""), "utf8");
  const rightBuffer = Buffer.from(String(right || ""), "utf8");

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function normalizeIp(value) {
  return String(value || "")
    .trim()
    .replace(/^::ffff:/, "");
}

function getRequestIp(req) {
  const forwarded = String(req.get("x-forwarded-for") || "")
    .split(",")[0]
    .trim();

  return normalizeIp(forwarded || req.ip || req.socket?.remoteAddress || "");
}

function deliveryAgentAuth(req, res, next) {
  const expectedKey = String(process.env.DELIVERY_AGENT_KEY || "").trim();

  // Le mod DayZ utilisé lors des essais envoie agentKey dans le JSON.
  // Les en-têtes restent prioritaires pour les futurs agents compatibles.
  const providedKey = String(
    req.get("x-delivery-agent-key") ||
      req.get("authorization")?.replace(/^Bearer\s+/i, "") ||
      req.body?.agentKey ||
      ""
  ).trim();

  if (!expectedKey) {
    return res.status(503).json({
      error: "DELIVERY_AGENT_KEY n'est pas configurée sur le backend."
    });
  }

  const allowedIps = String(process.env.DELIVERY_AGENT_ALLOWED_IPS || "")
    .split(",")
    .map(normalizeIp)
    .filter(Boolean);

  if (allowedIps.length > 0) {
    const requestIp = getRequestIp(req);

    if (!allowedIps.includes(requestIp)) {
      return res.status(403).json({
        error: "Adresse IP de l'agent non autorisée."
      });
    }
  }

  if (!providedKey || !safeEqual(providedKey, expectedKey)) {
    return res.status(401).json({
      error: "Clé de l'agent de livraison invalide."
    });
  }

  next();
}

module.exports = deliveryAgentAuth;
