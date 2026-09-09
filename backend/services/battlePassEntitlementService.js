const { createClient } = require('@supabase/supabase-js');

async function entitlement(body) {
  const fields = ['AgentKey', 'AgentId', 'SteamId', 'SeasonCode'];
  if (!body || Array.isArray(body) || Object.keys(body).some(k => !fields.includes(k)) ||
      typeof body.SteamId !== 'string' || !/^\d{17}$/.test(body.SteamId) || body.SeasonCode !== 'S01') {
    throw Object.assign(new Error('INVALID_REQUEST'), { code: 'INVALID_REQUEST' });
  }
  const url = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('ENTITLEMENT_UNAVAILABLE');
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  // Read only: do not call existing helpers which create levels/player rows.
  const { data: season, error: seasonError } = await db.from('battle_pass_seasons')
    .select('id').eq('code', body.SeasonCode).maybeSingle();
  if (seasonError) throw new Error('ENTITLEMENT_UNAVAILABLE');
  if (!season) throw Object.assign(new Error('INVALID_SEASON'), { code: 'INVALID_SEASON' });
  const { data: player, error: playerError } = await db.from('battle_pass_players')
    .select('is_premium').eq('season_id', season.id).eq('steam_id', body.SteamId).maybeSingle();
  if (playerError || (player && typeof player.is_premium !== 'boolean')) throw new Error('ENTITLEMENT_UNAVAILABLE');
  return { success: true, seasonCode: body.SeasonCode, steamId: body.SteamId, premium: player?.is_premium === true };
}
module.exports = { entitlement };
