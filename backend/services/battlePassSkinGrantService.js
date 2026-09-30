const { createClient } = require('@supabase/supabase-js');

function database() {
  const url = String(process.env.SUPABASE_URL || '').trim();
  const key = String(process.env.SUPABASE_SECRET_KEY || '').trim();
  if (!url || !key) throw new Error('SUPABASE_NOT_CONFIGURED');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function rpc(name, args) {
  const { data, error } = await database().rpc(name, args);
  if (error) throw error;
  return data;
}

async function create(claim) {
  return rpc('create_battle_pass_skin_claim', { p_claim: claim });
}

async function poll(body) {
  if (!body || typeof body.AgentId !== 'string') throw new Error('INVALID_REQUEST');
  return rpc('claim_battle_pass_skin_grant', { p_agent_id: body.AgentId });
}

async function complete(body) {
  if (!body || typeof body.AgentId !== 'string' || typeof body.ClaimId !== 'string' ||
      typeof body.ClaimToken !== 'string' || typeof body.Result !== 'string' ||
      !Number.isInteger(body.LBmasterCode)) throw new Error('INVALID_REQUEST');
  const allowed = new Set(['success', 'alreadyExists', 'permanentError', 'retry']);
  if (!allowed.has(body.Result)) throw new Error('INVALID_REQUEST');
  return rpc('complete_battle_pass_skin_grant', {
    p_claim_id: body.ClaimId,
    p_claim_token: body.ClaimToken,
    p_agent_id: body.AgentId,
    p_result: body.Result,
    p_lbmaster_code: body.LBmasterCode
  });
}

function firstString(obj, names) {
  for (const name of names) {
    if (typeof obj?.[name] === 'string' && obj[name].trim()) return obj[name].trim();
  }
  return '';
}

function toLBmasterCommand(grant) {
  if (!grant || typeof grant !== 'object') throw new Error('INVALID_GRANT');

  const claimId = firstString(grant, ['id', 'claim_id', 'claimId', 'ClaimId']);
  const claimToken = firstString(grant, ['claim_token', 'claimToken', 'ClaimToken']);
  const steamId = firstString(grant, ['steam_id', 'steamId', 'SteamId']);
  const permission = firstString(grant, ['permission_name', 'permission', 'Permission']);

  if (!claimId || !claimToken || !/^\d{17}$/.test(steamId) ||
      !/^[A-Za-z_][A-Za-z0-9_]{0,127}$/.test(permission)) {
    throw new Error('INVALID_GRANT');
  }

  return {
    id: claimId,
    token: claimToken,
    command: `/skinpermissions add player ${steamId} ${permission}`,
    steamId,
    permission
  };
}

function fromLBmasterResponse(body, agentId) {
  if (!body || typeof body !== 'object') throw new Error('INVALID_REQUEST');

  const claimId = firstString(body, ['id', 'claimId', 'ClaimId']);
  const claimToken = firstString(body, ['token', 'claimToken', 'ClaimToken']);
  const rawResult = firstString(body, ['result', 'Result', 'status', 'Status']).toLowerCase();
  const rawCode = body.code ?? body.Code ?? body.lbmasterCode ?? body.LBmasterCode ?? 0;
  const code = Number(rawCode);

  let result = 'retry';
  if (['success', 'ok', 'completed'].includes(rawResult)) result = 'success';
  else if (['alreadyexists', 'already_exists', 'exists'].includes(rawResult)) result = 'alreadyExists';
  else if (['permanenterror', 'permanent_error', 'invalid', 'failed'].includes(rawResult)) result = 'permanentError';

  if (!claimId || !claimToken || !Number.isInteger(code)) throw new Error('INVALID_REQUEST');

  return {
    AgentId: agentId,
    ClaimId: claimId,
    ClaimToken: claimToken,
    Result: result,
    LBmasterCode: code
  };
}

module.exports = { create, poll, complete, toLBmasterCommand, fromLBmasterResponse };
