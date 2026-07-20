const crypto = require("crypto");

function signSteamId(steamId, secret) {
  const signature = crypto.createHmac("sha256", secret).update(steamId).digest("hex");
  return `${steamId}.${signature}`;
}

function verifySteamId(cookieValue, secret) {
  const [steamId, signature] = String(cookieValue || "").split(".");
  if (!/^\d{17}$/.test(steamId || "") || !/^[a-f0-9]{64}$/i.test(signature || "")) {
    return null;
  }

  const expected = crypto.createHmac("sha256", secret).update(steamId).digest("hex");
  const suppliedBuffer = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");

  if (suppliedBuffer.length !== expectedBuffer.length) return null;
  return crypto.timingSafeEqual(suppliedBuffer, expectedBuffer) ? steamId : null;
}

module.exports = { signSteamId, verifySteamId };
