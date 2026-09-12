const express = require("express");
const {
  Tip4ServWebhookError,
  processWebhook
} = require("../services/tip4servWebhookService");

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const result = await processWebhook({
      rawBody: req.body,
      timestamp: req.get("X-Pay-Timestamp"),
      signature: req.get("X-Pay-Signature"),
      secret: process.env.TIP4SERV_WEBHOOK_SECRET
    });
    return res.status(result.status).json(result.body);
  } catch (error) {
    if (error instanceof Tip4ServWebhookError) {
      // Do not log the raw payload, signature, secret or SteamID.
      console.warn("[TIP4SERV] Webhook refused:", error.code);
      return res.status(error.status).json({ ok: false, errorCode: error.code });
    }

    console.error("[TIP4SERV] Unexpected webhook failure");
    return res.status(503).json({ ok: false, errorCode: "SUPABASE_ERROR" });
  }
});

module.exports = router;
