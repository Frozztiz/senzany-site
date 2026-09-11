const express = require('express');
const crypto = require('node:crypto');
const service = require('../services/battlePassDeliveryService');
const router = express.Router();

function keyMatches(provided, expected) {
  if (typeof provided !== 'string' || !expected || provided.length > 1024) return false;
  const a = Buffer.from(provided), b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function authenticate(req, res, next) {
  res.set('Cache-Control', 'no-store');
  // Uppercase AgentKey is the established DayZ request contract. Do not mutate
  // the existing delivery-agent middleware or accept a portal session instead.
  const key = String(process.env.DELIVERY_AGENT_KEY || '').trim();
  if (process.env.BATTLE_PASS_DELIVERY_ENABLED !== 'true' || !key) {
    return res.status(503).json({ errorCode: 'DELIVERY_UNAVAILABLE' });
  }
  if (!req.is('application/json')) return res.status(415).json({ errorCode: 'INVALID_REQUEST' });
  if (!keyMatches(req.body?.AgentKey, key)) return res.status(401).json({ errorCode: 'UNAUTHORIZED' });
  const agents = String(process.env.BATTLE_PASS_AGENT_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!agents.includes(req.body?.AgentId)) return res.status(403).json({ errorCode: 'UNAUTHORIZED' });
  return next();
}

router.post('/entitlement', authenticate, async (req, res) => {
  try {
    return res.json(await require('../services/battlePassEntitlementService').entitlement(req.body));
  } catch (error) {
    const code = ['INVALID_REQUEST', 'INVALID_SEASON'].includes(error.code) ? error.code : 'ENTITLEMENT_UNAVAILABLE';
    return res.status(code === 'ENTITLEMENT_UNAVAILABLE' ? 503 : 400).json({ success: false, errorCode: code });
  }
});

router.post('/claim', authenticate, async (req, res) => {
  try {
    return res.status(200).json(await service.claim(req.body));
  } catch (error) {
    const code = service.failureCodes.has(error.code) ? error.code : 'DELIVERY_FAILED';
    // No key, request body, SQL error, player name or database credentials in logs.
    console.warn('[ABP][API] claim rejected code=' + code);
    const keyValue = typeof req.body?.ClaimKey === 'string' && /^[A-Za-z0-9_.|\-]{1,128}$/.test(req.body.ClaimKey)
      ? req.body.ClaimKey : '';
    // Business failures have a strict, disjoint negative schema. HTTP 200 alone
    // never means accepted. Authentication failures remain HTTP 401/403/503.
    return res.status(200).json({ success: false, claimKey: keyValue, deliveryCreated: false, errorCode: code });
  }
});

router.post('/lbmaster-skins/poll', authenticate, async (req, res) => {
  try {
    const grant = await require('../services/battlePassSkinGrantService').poll(req.body);
    return res.status(200).json({ success: true, grant });
  } catch (error) {
    console.warn('[ABP][LBMASTER] poll failed');
    return res.status(503).json({ success: false, errorCode: 'SKIN_GRANT_UNAVAILABLE' });
  }
});

router.post('/lbmaster-skins/complete', authenticate, async (req, res) => {
  try {
    const result = await require('../services/battlePassSkinGrantService').complete(req.body);
    return res.status(200).json(result);
  } catch (error) {
    console.warn('[ABP][LBMASTER] completion failed');
    return res.status(503).json({ success: false, errorCode: 'SKIN_GRANT_UNAVAILABLE' });
  }
});
module.exports = router;
