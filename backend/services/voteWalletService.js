const supabaseService = require('./supabaseService');
const deliveryService = require('./deliveryService');
const voteAliasService = require('./voteAliasService');

const AMOUNT_PER_VOTE = Math.max(1, Number.parseInt(process.env.VOTE_WALLET_AMOUNT_PER_VOTE || '1000', 10) || 1000);
const DEFAULT_MILESTONES = Array.from({ length: 10 }, (_, i) => (i + 1) * 50);

function currentPeriod() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit' }).formatToParts(new Date());
  return `${parts.find(p=>p.type==='year').value}-${parts.find(p=>p.type==='month').value}`;
}

function milestones() {
  const raw = String(process.env.VOTE_MILESTONES || '').trim();
  const values = raw ? raw.split(',').map(v=>Number.parseInt(v.trim(),10)).filter(v=>Number.isFinite(v)&&v>0) : DEFAULT_MILESTONES;
  return [...new Set(values)].sort((a,b)=>a-b);
}

async function getWalletRow(steamId) {
  const rows = await supabaseService.request(`vote_wallets?steam_id=eq.${encodeURIComponent(steamId)}&select=steam_id,balance,lifetime_earned,lifetime_claimed,updated_at&limit=1`, { method:'GET' });
  return Array.isArray(rows) && rows.length ? rows[0] : { steam_id:steamId, balance:0, lifetime_earned:0, lifetime_claimed:0, updated_at:null };
}

async function getActiveOwnership(aliasEntry) {
  const normalized = voteAliasService.normalizeAlias(aliasEntry.alias);
  const rows = await supabaseService.request(`vote_alias_ownerships?normalized_alias=eq.${encodeURIComponent(normalized)}&ended_at=is.null&select=id,steam_id,alias,normalized_alias,baseline_period,baseline_votes&limit=1`, {method:'GET'});
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function createOwnership({ aliasEntry, steamId, baselineVotes = 0, migrated = false }) {
  const normalized = voteAliasService.normalizeAlias(aliasEntry.alias);
  const rows = await supabaseService.request('vote_alias_ownerships', {
    method:'POST', headers:{Prefer:'return=representation'}, body:JSON.stringify({
      alias_id: aliasEntry.id || null,
      steam_id: String(steamId),
      alias: aliasEntry.alias,
      normalized_alias: normalized,
      baseline_period: currentPeriod(),
      baseline_votes: Math.max(0, Number(baselineVotes)||0),
      migrated:Boolean(migrated)
    })
  });
  return Array.isArray(rows) ? rows[0] : rows;
}

async function registerAlias({ aliasEntry, steamId, baselineVotes }) {
  const existing = await getActiveOwnership(aliasEntry);
  if (existing) return existing;
  return createOwnership({ aliasEntry, steamId, baselineVotes, migrated:false });
}

async function closeAliasOwnership(aliasEntry, steamId) {
  const normalized = voteAliasService.normalizeAlias(aliasEntry.alias);
  await supabaseService.request(`vote_alias_ownerships?normalized_alias=eq.${encodeURIComponent(normalized)}&steam_id=eq.${encodeURIComponent(steamId)}&ended_at=is.null`, {
    method:'PATCH', headers:{Prefer:'return=minimal'}, body:JSON.stringify({ ended_at:new Date().toISOString() })
  });
}

async function syncForPlayer({ steamId, aliases, aliasDetails }) {
  const detailMap = new Map((Array.isArray(aliasDetails)?aliasDetails:[]).map(d=>[voteAliasService.normalizeAlias(d.alias), d]));
  const period = currentPeriod();
  let creditedVotes = 0;
  let creditedAmount = 0;

  for (const aliasEntry of Array.isArray(aliases)?aliases:[]) {
    let ownership = await getActiveOwnership(aliasEntry);
    if (!ownership) {
      // Sécurité : un pseudo ancien sans historique est traité comme migration et conserve ses votes actuels.
      ownership = await createOwnership({ aliasEntry, steamId, baselineVotes:0, migrated:true });
    }
    if (String(ownership.steam_id) !== String(steamId)) continue;
    const detail = detailMap.get(voteAliasService.normalizeAlias(aliasEntry.alias));
    const currentVotes = Math.max(0, Number(detail?.votes)||0);
    const result = await supabaseService.request('rpc/credit_vote_wallet_alias', {
      method:'POST', body:JSON.stringify({
        p_ownership_id: ownership.id,
        p_period: period,
        p_current_votes: currentVotes,
        p_amount_per_vote: AMOUNT_PER_VOTE
      })
    });
    const row = Array.isArray(result) ? result[0] : result;
    creditedVotes += Number(row?.delta_votes||0);
    creditedAmount += Number(row?.credited_amount||0);
  }
  return { creditedVotes, creditedAmount, wallet: await getWalletRow(steamId) };
}

const PRODUCTION_DENOMINATIONS = [
  { value: 100, className: 'MoneyRuble100', name: 'Billet 100 $' },
  { value: 50, className: 'MoneyRuble50', name: 'Billet 50 $' },
  { value: 25, className: 'MoneyRuble25', name: 'Billet 25 $' },
  { value: 10, className: 'MoneyRuble10', name: 'Billet 10 $' },
  { value: 5, className: 'MoneyRuble5', name: 'Billet 5 $' },
  { value: 1, className: 'MoneyRuble1', name: 'Billet 1 $' }
];

// Serveur de test : MoneyRuble n'est pas chargé. On utilise donc une monnaie
// Expansion réellement spawnable afin de valider toute la chaîne Delivery.
// Nouvelle monnaie Expansion : sa valeur unitaire est 1 $.
// Le Delivery server-side regroupe ensuite la somme dans UN SEUL stack
// via SetQuantity(amount), au lieu de creer N objets physiques.
const TEST_DENOMINATIONS = [
  { value: 1, className: 'ExpansionBanknoteHryvnia', name: 'Monnaie Expansion' }
];

function getDayzEnvironment() {
  return String(
    process.env.DAYZ_DELIVERY_ENVIRONMENT ||
    process.env.DAYZ_RCON_ENVIRONMENT ||
    'production'
  ).trim().toLowerCase();
}

function defaultDenominationsForEnvironment() {
  return getDayzEnvironment() === 'test' ? TEST_DENOMINATIONS : PRODUCTION_DENOMINATIONS;
}

function parseDenominations() {
  const defaults = defaultDenominationsForEnvironment();
  const raw = String(process.env.VOTE_WALLET_DENOMINATIONS_JSON || '').trim();
  if (!raw) return defaults;
  try {
    const parsed = JSON.parse(raw);
    const configured = (Array.isArray(parsed)?parsed:[]).map(x=>({
      value:Math.max(1,Number.parseInt(x.value,10)||0),
      className:String(x.className||x.classname||'').trim(),
      name:String(x.name||x.displayName||x.className||'').trim()
    })).filter(x=>x.value>0&&x.className).sort((a,b)=>b.value-a.value);
    return configured.length ? configured : defaults;
  } catch {
    return defaults;
  }
}

function buildCurrencyItems(amount) {
  const denoms = parseDenominations();
  if (!denoms.length) {
    const error = new Error('La conversion de la cagnotte vers la monnaie DayZ n’est pas encore configurée.');
    error.code = 'CURRENCY_NOT_CONFIGURED'; error.status = 503; throw error;
  }
  let remaining = amount;
  const items=[];
  for (const denom of denoms) {
    const quantity = Math.floor(remaining / denom.value);
    if (quantity > 0) {
      items.push({ className:denom.className, name:denom.name || `${denom.value} $`, quantity });
      remaining -= quantity * denom.value;
    }
  }
  if (remaining !== 0) {
    const error = new Error(`Le montant ${amount} $ ne peut pas être converti exactement avec les coupures configurées.`);
    error.code='UNREPRESENTABLE_AMOUNT'; error.status=422; throw error;
  }
  return items;
}

async function getSummary(steamId, monthlyVotes = 0) {
  const wallet = await getWalletRow(steamId);
  const tiers = milestones();
  const votes = Math.max(0,Number(monthlyVotes)||0);
  const next = tiers.find(v=>v>votes) || (Math.floor(votes/50)+1)*50;
  return {
    amountPerVote: AMOUNT_PER_VOTE,
    balance:Number(wallet.balance||0),
    lifetimeEarned:Number(wallet.lifetime_earned||0),
    lifetimeClaimed:Number(wallet.lifetime_claimed||0),
    monthlyVotes:votes,
    milestones:tiers.map(value=>({ value, unlocked:votes>=value })),
    nextMilestone:next,
    votesToNext:Math.max(0,next-votes),
    claimConfigured:parseDenominations().length>0
  };
}

async function claimAll({ steamId, playerName }) {
  const wallet = await getWalletRow(steamId);
  const amount = Number(wallet.balance||0);
  if (amount <= 0) { const e=new Error('Ta cagnotte est vide.'); e.status=409; throw e; }
  const items = buildCurrencyItems(amount); // valide AVANT de débiter
  const claimResult = await supabaseService.request('rpc/reserve_vote_wallet_claim', { method:'POST', body:JSON.stringify({p_steam_id:String(steamId),p_amount:amount}) });
  const claimId = Array.isArray(claimResult) ? claimResult[0] : claimResult;
  try {
    const delivery = await deliveryService.createDelivery({
      steamId:String(steamId), playerName:playerName||null,
      title:'Cagnotte de votes',
      message:`Cagnotte réclamée depuis le profil Senzany : ${amount.toLocaleString('fr-FR')} $.`,
      items,
      createdBy:String(steamId), createdByName:'Cagnotte votes — Claim joueur'
    });
    await supabaseService.request(`vote_wallet_claims?id=eq.${encodeURIComponent(claimId)}`, { method:'PATCH', headers:{Prefer:'return=minimal'}, body:JSON.stringify({status:'delivery_created',delivery_id:delivery.id,updated_at:new Date().toISOString()}) });
    return { amount, claimId, deliveryId:delivery.id, wallet:await getWalletRow(steamId) };
  } catch (error) {
    await supabaseService.request('rpc/refund_vote_wallet_claim', { method:'POST', body:JSON.stringify({p_claim_id:claimId,p_error:String(error?.message||error).slice(0,500)}) }).catch(()=>{});
    throw error;
  }
}

module.exports = { AMOUNT_PER_VOTE, currentPeriod, milestones, registerAlias, closeAliasOwnership, syncForPlayer, getSummary, claimAll };
