function deliveryAgentAuth(req, res, next) {
  const expectedKey = String(process.env.DELIVERY_AGENT_KEY || "").trim();
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

  if (!providedKey || providedKey !== expectedKey) {
    return res.status(401).json({
      error: "Clé de l'agent de livraison invalide."
    });
  }

  next();
}

module.exports = deliveryAgentAuth;
