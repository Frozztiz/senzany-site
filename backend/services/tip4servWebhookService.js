const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");

const PRODUCT_ID = "723";
const MAX_AGE_SECONDS = 300;
const STEAM_ID_64 = /^\d{17}$/;
const HEX_SHA256 = /^[0-9a-fA-F]{64}$/;
const BASE64_SECRET = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

class Tip4ServWebhookError extends Error {
  constructor(code, status) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

function fail(code, status) {
  throw new Tip4ServWebhookError(code, status);
}

function decodeWebhookSecret(encodedSecret) {
  const value = String(encodedSecret || "").trim();
  if (!value || value.length % 4 !== 0 || !BASE64_SECRET.test(value)) {
    fail("WEBHOOK_NOT_CONFIGURED", 503);
  }

  const secret = Buffer.from(value, "base64");
  if (!secret.length || secret.toString("base64") !== value) {
    fail("WEBHOOK_NOT_CONFIGURED", 503);
  }
  return secret;
}

function verifySignature(rawBody, timestampHeader, signatureHeader, encodedSecret, nowSeconds) {
  if (!Buffer.isBuffer(rawBody)) fail("RAW_BODY_REQUIRED", 400);

  const timestampText = String(timestampHeader || "").trim();
  if (!/^\d{10}$/.test(timestampText)) fail("INVALID_TIMESTAMP", 401);

  const timestamp = Number(timestampText);
  if (!Number.isSafeInteger(timestamp) || Math.abs(nowSeconds - timestamp) > MAX_AGE_SECONDS) {
    fail("EXPIRED_TIMESTAMP", 401);
  }

  const signatureText = String(signatureHeader || "").trim();
  if (!HEX_SHA256.test(signatureText)) fail("INVALID_SIGNATURE", 401);

  const expected = crypto
    .createHmac("sha256", decodeWebhookSecret(encodedSecret))
    .update(timestampText + ".", "utf8")
    .update(rawBody)
    .digest();
  const received = Buffer.from(signatureText, "hex");

  if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) {
    fail("INVALID_SIGNATURE", 401);
  }
}

function parsePayload(rawBody) {
  let payload;
  try {
    payload = JSON.parse(rawBody.toString("utf8"));
  } catch (_error) {
    fail("INVALID_JSON", 400);
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    fail("INVALID_PAYLOAD", 400);
  }
  return payload;
}

function normalizeStableId(value, code) {
  if ((typeof value !== "string" && typeof value !== "number") ||
      !/^[A-Za-z0-9_.:-]{1,160}$/.test(String(value))) {
    fail(code, 200);
  }
  return String(value);
}

function extractPayment(payload) {
  if (payload.event !== "payment.success") {
    return { ignored: true, code: "EVENT_NOT_HANDLED" };
  }

  const data = payload.data;
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    fail("INVALID_PAYLOAD", 200);
  }

  const basket = Array.isArray(data.basket) ? data.basket : [];
  const product = basket.find((item) => item && String(item.id) === PRODUCT_ID);
  if (!product) return { ignored: true, code: "PRODUCT_NOT_FOUND" };

  const steamId = data.user && data.user.steam_id;
  if (typeof steamId !== "string" || !STEAM_ID_64.test(steamId)) {
    fail("INVALID_STEAM_ID", 200);
  }

  return {
    ignored: false,
    requestId: normalizeStableId(payload.request_id, "INVALID_REQUEST_ID"),
    paymentId: normalizeStableId(data.id, "INVALID_PAYMENT_ID"),
    transactionId: normalizeStableId(data.transaction_id, "INVALID_TRANSACTION_ID"),
    storeId: normalizeStableId(payload.store_id, "INVALID_STORE_ID"),
    mode: payload.mode === "live" || payload.mode === "test"
      ? payload.mode
      : fail("INVALID_MODE", 200),
    steamId,
    productId: Number(PRODUCT_ID)
  };
}

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !serviceKey) fail("SUPABASE_NOT_CONFIGURED", 503);
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

async function activatePremium(payment) {
  const { data, error } = await getSupabaseClient().rpc(
    "activate_tip4serv_battle_pass_premium",
    {
      p_request_id: payment.requestId,
      p_payment_id: payment.paymentId,
      p_transaction_id: payment.transactionId,
      p_store_id: payment.storeId,
      p_mode: payment.mode,
      p_steam_id: payment.steamId,
      p_product_id: payment.productId
    }
  );

  if (error || !data || data.success !== true) {
    if (data && data.errorCode === "NO_ACTIVE_SEASON") {
      fail("NO_ACTIVE_SEASON", 503);
    }
    fail("SUPABASE_ERROR", 503);
  }
  return data;
}

async function processWebhook(options) {
  const nowSeconds = options.nowSeconds === undefined
    ? Math.floor(Date.now() / 1000)
    : options.nowSeconds;
  verifySignature(
    options.rawBody,
    options.timestamp,
    options.signature,
    options.secret,
    nowSeconds
  );

  const payment = extractPayment(parsePayload(options.rawBody));
  if (payment.ignored) {
    return { status: 200, body: { ok: true, processed: false, reason: payment.code } };
  }

  const result = await (options.activatePremium || activatePremium)(payment);
  if (!result || result.success !== true) {
    if (result && result.errorCode === "NO_ACTIVE_SEASON") fail("NO_ACTIVE_SEASON", 503);
    fail("SUPABASE_ERROR", 503);
  }

  return {
    status: 200,
    body: {
      ok: true,
      processed: true,
      alreadyProcessed: result.alreadyProcessed === true,
      alreadyPremium: result.alreadyPremium === true
    }
  };
}

module.exports = {
  PRODUCT_ID,
  MAX_AGE_SECONDS,
  Tip4ServWebhookError,
  verifySignature,
  extractPayment,
  processWebhook
};
