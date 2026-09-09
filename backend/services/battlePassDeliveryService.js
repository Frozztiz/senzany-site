// Claim boundary for the existing delivery service. Never accepts browser identity.
const deliveryService = require('./deliveryService');

const failureCodes = new Set(['INVALID_SEASON', 'INVALID_REWARD', 'LEVEL_REQUIRED',
  'PREMIUM_REQUIRED', 'UNSUPPORTED_REWARD', 'DELIVERY_FAILED', 'INVALID_REQUEST']);
function invalid(code = 'INVALID_REQUEST') {
  const error = new Error(code); error.code = code; throw error;
}
function normalizeClaim(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) invalid();
  const fields = new Set(['AgentKey', 'AgentId', 'SteamId', 'PlayerName', 'SeasonId',
    'Level', 'Premium', 'PlayerLevel', 'ClaimKey', 'Rewards']);
  if (Object.keys(body).some(k => !fields.has(k))) invalid();
  if (typeof body.SteamId !== 'string' || !/^\d{17}$/.test(body.SteamId)) invalid();
  if (body.SeasonId !== 'S01') invalid('INVALID_SEASON');
  if (!Number.isInteger(body.Level) || body.Level < 1 || body.Level > 200 ||
      !Number.isInteger(body.PlayerLevel) || body.PlayerLevel < 1 || body.PlayerLevel > 200 ||
      typeof body.Premium !== 'boolean') invalid();
  const claimKey = `${body.SeasonId}|${body.SteamId}|${body.Level}|${body.Premium ? 'premium' : 'free'}`;
  if (body.ClaimKey !== claimKey) invalid();
  if (typeof body.PlayerName !== 'string' || body.PlayerName.length > 128 ||
      typeof body.AgentId !== 'string' || !/^[A-Za-z0-9_.-]{1,64}$/.test(body.AgentId)) invalid();
  if (!Array.isArray(body.Rewards) || !body.Rewards.length || body.Rewards.length > 100) invalid('INVALID_REWARD');
  const items = body.Rewards.map(r => {
    if (!r || typeof r !== 'object' || Array.isArray(r) ||
        Object.keys(r).some(k => !['ClassName', 'Quantity', 'HealthPercent', 'AttachmentPreset', 'Attachments'].includes(k)) ||
        typeof r.ClassName !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]{0,159}$/.test(r.ClassName) ||
        !Number.isInteger(r.Quantity) || r.Quantity < 1 || r.Quantity > 100) invalid('INVALID_REWARD');
    // Current SenzanyDelivery item model has no attachment/health fields.
    // Reject these rewards instead of acknowledging a partial delivery.
    if (r.HealthPercent !== 100 || r.AttachmentPreset !== '' || !Array.isArray(r.Attachments) ||
        r.Attachments.length || r.ClassName === 'SenzanyBankCredit') invalid('UNSUPPORTED_REWARD');
    return { classname: r.ClassName, quantity: r.Quantity };
  });
  return { steamId: body.SteamId, playerName: body.PlayerName, seasonId: body.SeasonId,
    level: body.Level, premium: body.Premium, playerLevel: body.PlayerLevel,
    claimKey, agentId: body.AgentId, items };
}

async function claim(body) {
  const request = normalizeClaim(body);
  // This branch is atomic in Postgres; other createDelivery callers are unchanged.
  const result = await deliveryService.createDelivery({ battlePassClaim: request });
  if (result && result.success === false && failureCodes.has(result.errorCode)) {
    return { success: false, claimKey: request.claimKey, deliveryCreated: false, errorCode: result.errorCode };
  }
  if (!result || result.success !== true || result.claimKey !== request.claimKey ||
      typeof result.deliveryCreated !== 'boolean' || typeof result.alreadyExists !== 'boolean' ||
      result.deliveryCreated === result.alreadyExists) invalid('DELIVERY_FAILED');
  return { success: true, claimKey: request.claimKey, deliveryCreated: result.deliveryCreated,
    alreadyExists: result.alreadyExists };
}
module.exports = { claim, normalizeClaim, failureCodes };
