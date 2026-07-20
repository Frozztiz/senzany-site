const crypto = require("crypto");

function createOAuthState(steamId, secret) {
  const payload = Buffer.from(
    JSON.stringify({
      steamId,
      ts: Date.now(),
      nonce: crypto.randomBytes(18).toString("hex"),
    })
  ).toString("base64url");

  const signature = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");

  return `${payload}.${signature}`;
}

function verifyOAuthState(value, secret, maxAgeMs = 10 * 60 * 1000) {
  const [payload, signature] = String(value || "").split(".");

  if (!payload || !signature) {
    return null;
  }

  const expected = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");

  const suppliedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (
    suppliedBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(suppliedBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const data = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    );

    if (!/^\d{17}$/.test(data.steamId || "")) {
      return null;
    }

    if (
      !Number.isFinite(data.ts) ||
      Date.now() - data.ts > maxAgeMs ||
      data.ts > Date.now() + 60_000
    ) {
      return null;
    }

    return data;
  } catch {
    return null;
  }
}

module.exports = {
  createOAuthState,
  verifyOAuthState,
};