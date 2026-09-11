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

module.exports = { create, poll, complete };
