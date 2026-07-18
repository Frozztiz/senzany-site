const crypto = require("crypto");

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  header.split(";").forEach((part) => {
    const idx = part.indexOf("=");
    if (idx === -1) return;
    out[part.slice(0, idx).trim()] = part.slice(idx + 1).trim();
  });
  return out;
}

function verifySteamId(cookieValue, secret) {
  const [steamId, signature] = (cookieValue || "").split(".");
  if (!/^\d{17}$/.test(steamId || "") || !/^[a-f0-9]{64}$/i.test(signature || "")) return null;
  const expected = crypto.createHmac("sha256", secret).update(steamId).digest("hex");
  const a = Buffer.from(signature, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length) return null;
  return crypto.timingSafeEqual(a, b) ? steamId : null;
}

function createOAuthState(steamId, secret) {
  const payload = Buffer.from(JSON.stringify({
    steamId,
    ts: Date.now(),
    nonce: crypto.randomBytes(18).toString("hex"),
  })).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

function verifyOAuthState(value, secret, maxAgeMs = 10 * 60 * 1000) {
  const [payload, sig] = (value || "").split(".");
  if (!payload || !sig) return null;
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!/^\d{17}$/.test(data.steamId || "")) return null;
    if (!Number.isFinite(data.ts) || Date.now() - data.ts > maxAgeMs || data.ts > Date.now() + 60000) return null;
    return data;
  } catch {
    return null;
  }
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
    body: JSON.stringify(body),
  };
}

module.exports = { parseCookies, verifySteamId, createOAuthState, verifyOAuthState, json };
