const supabaseService = require('./supabaseService');

function normalizeSteamId(steamId) {
  return String(steamId || '').trim();
}

async function getActive(steamId) {
  const normalizedSteamId = normalizeSteamId(steamId);
  if (!normalizedSteamId) return null;

  const now = new Date().toISOString();
  const rows = await supabaseService.request(
    `vote_suspensions?steam_id=eq.${encodeURIComponent(normalizedSteamId)}` +
      `&starts_at=lte.${encodeURIComponent(now)}` +
      `&ends_at=gt.${encodeURIComponent(now)}` +
      '&select=steam_id,player_name,reason,block_votes,block_rewards,starts_at,ends_at,created_at&limit=1',
    { method: 'GET' }
  );

  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

function publicView(suspension) {
  if (!suspension) return null;
  return {
    active: true,
    reason: suspension.reason || null,
    blockVotes: suspension.block_votes === true,
    blockRewards: suspension.block_rewards === true,
    startsAt: suspension.starts_at || null,
    endsAt: suspension.ends_at || null,
  };
}

function suspensionError(suspension, action = 'rewards') {
  const isVote = action === 'votes';
  const error = new Error(
    isVote
      ? 'Ton accès aux votes est temporairement suspendu.'
      : 'La récupération des récompenses de votes est temporairement suspendue.'
  );
  error.status = 403;
  error.code = isVote ? 'VOTES_SUSPENDED' : 'VOTE_REWARDS_SUSPENDED';
  error.suspension = publicView(suspension);
  return error;
}

async function assertRewardsAllowed(steamId) {
  const suspension = await getActive(steamId);
  if (suspension?.block_rewards) throw suspensionError(suspension, 'rewards');
  return suspension;
}

module.exports = {
  getActive,
  publicView,
  suspensionError,
  assertRewardsAllowed,
};
