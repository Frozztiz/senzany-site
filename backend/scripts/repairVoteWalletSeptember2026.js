#!/usr/bin/env node
"use strict";

/**
 * Senzany — Réparation contrôlée du rollover de la cagnotte de votes
 * Cible unique : septembre 2026
 *
 * Par défaut : SIMULATION UNIQUEMENT.
 *
 * Exécution réelle :
 *   node repairVoteWalletSeptember2026.js \
 *     --execute \
 *     --confirm=SEPTEMBRE-2026-VOTE-WALLET
 *
 * IMPORTANT :
 * - Le script revalide les données au moment du lancement.
 * - Les ownerships dont le reset août -> septembre n'est pas prouvé sont exclus.
 * - Les livraisons déjà récupérées ne sont pas retirées aux joueurs.
 * - Le cas fryt85 47 000 ₽ pending est annulé sans rembourser le faux crédit.
 * - Aucun SteamID n'est écrit dans le rapport JSON ou affiché dans les tableaux.
 */

require("dotenv").config();

const fs = require("fs");
const path = require("path");

const supabaseService = require(
  path.resolve(__dirname, "../../backend/services/supabaseService")
);

const AUGUST_RUN_ID = "4ed81efa-ae7a-4f77-adcc-c1b2648c19ca";
const AUGUST_PERIOD = "2026-08";
const SEPTEMBER_PERIOD = "2026-09";
const AMOUNT_PER_VOTE = 1000;
const ROLLOVER_UTC = "2026-08-31T22:00:00.000Z";
const CONFIRM_TOKEN = "SEPTEMBRE-2026-VOTE-WALLET";

const args = new Set(process.argv.slice(2));
const EXECUTE = args.has("--execute");
const CONFIRM = [...args]
  .find((v) => v.startsWith("--confirm="))
  ?.slice("--confirm=".length);

const REPORT_PATH = path.resolve(
  process.cwd(),
  `vote-wallet-repair-2026-09-${EXECUTE ? "execute" : "simulation"}.json`
);

function n(value) {
  const x = Number(value || 0);
  return Number.isFinite(x) ? x : 0;
}

function short(value) {
  return String(value || "").slice(0, 8);
}

function sum(rows, selector) {
  return rows.reduce((acc, row) => acc + n(selector(row)), 0);
}

function uniq(values) {
  return [...new Set(values)];
}

function isoNow() {
  return new Date().toISOString();
}

function safeJson(value) {
  const blocked = new Set([
    "steam_id",
    "steamId",
    "ownership_id",
    "ownershipId",
    "claim_id",
    "claimId",
    "delivery_id",
    "deliveryId",
  ]);

  if (Array.isArray(value)) return value.map(safeJson);

  if (value && typeof value === "object") {
    const out = {};
    for (const [key, child] of Object.entries(value)) {
      if (blocked.has(key)) continue;
      out[key] = safeJson(child);
    }
    return out;
  }

  return value;
}

async function get(pathname) {
  return supabaseService.request(pathname, { method: "GET" });
}

async function patch(pathname, body) {
  return supabaseService.request(pathname, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(body),
  });
}

async function post(pathname, body) {
  return supabaseService.request(pathname, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(body),
  });
}

async function loadData() {
  const [
    august,
    ledger,
    ownerships,
    augPeriods,
    sepPeriods,
    wallets,
    claims,
    deliveries,
  ] = await Promise.all([
    get(
      `monthly_vote_rankings?run_id=eq.${AUGUST_RUN_ID}` +
        "&select=steam_id,player_name,votes"
    ),
    get(
      `vote_wallet_ledger?period=eq.${SEPTEMBER_PERIOD}` +
        "&kind=eq.vote_credit" +
        "&select=id,steam_id,ownership_id,amount,votes,created_at,idempotency_key,metadata" +
        "&order=created_at.asc"
    ),
    get(
      "vote_alias_ownerships" +
        "?select=id,steam_id,alias,baseline_period,baseline_votes,created_at,ended_at"
    ),
    get(
      `vote_wallet_alias_periods?period=eq.${AUGUST_PERIOD}` +
        "&select=ownership_id,baseline_votes,credited_votes,last_seen_votes,updated_at"
    ),
    get(
      `vote_wallet_alias_periods?period=eq.${SEPTEMBER_PERIOD}` +
        "&select=ownership_id,baseline_votes,credited_votes,last_seen_votes,updated_at"
    ),
    get(
      "vote_wallets?select=steam_id,balance,lifetime_earned,lifetime_claimed,updated_at"
    ),
    get(
      "vote_wallet_claims" +
        "?select=id,steam_id,amount,status,delivery_id,created_at,updated_at" +
        "&order=created_at.asc"
    ),
    get(
      "deliveries" +
        "?title=eq." +
        encodeURIComponent("Cagnotte de votes") +
        "&select=id,steam_id,player_name,status,created_at,claimed_at,cancelled_at" +
        "&order=created_at.asc"
    ),
  ]);

  return {
    august: Array.isArray(august) ? august : [],
    ledger: Array.isArray(ledger) ? ledger : [],
    ownerships: Array.isArray(ownerships) ? ownerships : [],
    augPeriods: Array.isArray(augPeriods) ? augPeriods : [],
    sepPeriods: Array.isArray(sepPeriods) ? sepPeriods : [],
    wallets: Array.isArray(wallets) ? wallets : [],
    claims: Array.isArray(claims) ? claims : [],
    deliveries: Array.isArray(deliveries) ? deliveries : [],
  };
}

function buildPlan(data) {
  const augustBySteam = new Map();
  for (const row of data.august) {
    if (!row.steam_id) continue;
    augustBySteam.set(String(row.steam_id), {
      playerName: row.player_name || "Joueur inconnu",
      votes: n(row.votes),
    });
  }

  const sepTotalVotesBySteam = new Map();
  for (const row of data.ledger) {
    if (!row.steam_id) continue;
    const steamId = String(row.steam_id);
    sepTotalVotesBySteam.set(
      steamId,
      (sepTotalVotesBySteam.get(steamId) || 0) + n(row.votes)
    );
  }

  // Garde-fou principal : le total des crédits de septembre doit reproduire
  // exactement le snapshot final d'août pour qualifier un joueur.
  const confirmedSteamIds = new Set();
  for (const [steamId, sepVotes] of sepTotalVotesBySteam.entries()) {
    const aug = augustBySteam.get(steamId);
    if (aug && aug.votes > 0 && sepVotes === aug.votes) {
      confirmedSteamIds.add(steamId);
    }
  }

  const ownerById = new Map(
    data.ownerships.map((row) => [String(row.id), row])
  );
  const augStateByOwner = new Map(
    data.augPeriods.map((row) => [String(row.ownership_id), row])
  );
  const sepStateByOwner = new Map(
    data.sepPeriods.map((row) => [String(row.ownership_id), row])
  );
  const walletBySteam = new Map(
    data.wallets.map((row) => [String(row.steam_id), row])
  );
  const deliveryById = new Map(
    data.deliveries.map((row) => [String(row.id), row])
  );

  const ownershipIds = uniq(
    data.ledger
      .filter((row) => confirmedSteamIds.has(String(row.steam_id)))
      .map((row) => String(row.ownership_id))
  );

  const ownershipPlans = [];

  for (const ownershipId of ownershipIds) {
    const owner = ownerById.get(ownershipId);
    const aug = augStateByOwner.get(ownershipId);
    const sep = sepStateByOwner.get(ownershipId);

    if (!owner || !aug || !sep) continue;

    const augLast = n(aug.last_seen_votes);
    const currentSep = n(sep.last_seen_votes);
    const resetConfirmed = currentSep < augLast;

    const falseLedgerRows = data.ledger.filter(
      (row) => String(row.ownership_id) === ownershipId
    );

    ownershipPlans.push({
      ownershipId,
      steamId: String(owner.steam_id),
      playerName:
        augustBySteam.get(String(owner.steam_id))?.playerName ||
        "Joueur inconnu",
      alias: owner.alias || "???",
      augLast,
      currentSep,
      creditedSep: n(sep.credited_votes),
      falseVotes: sum(falseLedgerRows, (r) => r.votes),
      falseAmount: sum(falseLedgerRows, (r) => r.amount),
      resetConfirmed,
      diagnostic: resetConfirmed
        ? "RESET_CONFIRME"
        : currentSep === augLast
        ? "RESET_NON_CONFIRME"
        : "COMPTEUR_SUPERIEUR",
    });
  }

  const resetPlans = ownershipPlans.filter((o) => o.resetConfirmed);
  const uncertainPlans = ownershipPlans.filter((o) => !o.resetConfirmed);

  const playerPlans = [];

  for (const steamId of confirmedSteamIds) {
    const playerOwnerships = ownershipPlans.filter(
      (o) => o.steamId === steamId
    );
    const resetOwnerships = playerOwnerships.filter((o) => o.resetConfirmed);
    const uncertainOwnerships = playerOwnerships.filter(
      (o) => !o.resetConfirmed
    );

    const wallet = walletBySteam.get(steamId);
    if (!wallet) continue;

    const claims = data.claims
      .filter(
        (claim) =>
          String(claim.steam_id) === steamId &&
          String(claim.created_at || "") >= ROLLOVER_UTC
      )
      .map((claim) => {
        const delivery = deliveryById.get(String(claim.delivery_id));
        return {
          id: String(claim.id),
          amount: n(claim.amount),
          status: claim.status || null,
          deliveryId: claim.delivery_id ? String(claim.delivery_id) : null,
          deliveryStatus: delivery?.status || null,
          claimedAt: delivery?.claimed_at || null,
          createdAt: claim.created_at || null,
        };
      });

    const falseAmount = sum(resetOwnerships, (o) => o.falseAmount);
    const trueVotes = sum(resetOwnerships, (o) => o.currentSep);
    const trueAmount = trueVotes * AMOUNT_PER_VOTE;

    const pendingFalseClaim = claims.find(
      (claim) =>
        claim.status === "delivery_created" &&
        claim.deliveryStatus === "pending" &&
        claim.amount === falseAmount
    );

    const hasRetrievedOrDeliveredClaim = claims.some(
      (claim) =>
        claim.status === "delivery_created" &&
        ["claimed", "delivered"].includes(String(claim.deliveryStatus))
    );

    let mode = "NO_RESET";
    if (resetOwnerships.length > 0) {
      if (pendingFalseClaim) {
        mode = "CANCEL_PENDING_FALSE_CLAIM";
      } else if (claims.length > 0 || hasRetrievedOrDeliveredClaim) {
        mode = "FORGIVE_ALREADY_CLAIMED_FALSE_AMOUNT";
      } else {
        mode = "REMOVE_FALSE_FROM_WALLET";
      }
    }

    // Les ownerships incertains d'un même joueur ne sont jamais modifiés.
    // Si le joueur n'a aucun ownership reset, aucune opération wallet.
    const currentBalance = n(wallet.balance);
    const currentEarned = n(wallet.lifetime_earned);
    const currentClaimed = n(wallet.lifetime_claimed);

    let targetBalance = currentBalance;
    let targetEarned = currentEarned;
    let targetClaimed = currentClaimed;

    if (mode === "REMOVE_FALSE_FROM_WALLET") {
      if (currentBalance < falseAmount) {
        throw new Error(
          `Garde-fou: solde insuffisant pour retirer le faux crédit de ${playerPlans.length + 1}`
        );
      }
      targetBalance = currentBalance - falseAmount + trueAmount;
      targetEarned = Math.max(0, currentEarned - falseAmount + trueAmount);
    } else if (mode === "FORGIVE_ALREADY_CLAIMED_FALSE_AMOUNT") {
      targetBalance = currentBalance + trueAmount;
      targetEarned = Math.max(0, currentEarned - falseAmount + trueAmount);
      // lifetime_claimed reste l'historique de ce qui a réellement été remis.
    } else if (mode === "CANCEL_PENDING_FALSE_CLAIM") {
      targetBalance = currentBalance + trueAmount;
      targetEarned = Math.max(0, currentEarned - falseAmount + trueAmount);
      targetClaimed = Math.max(
        0,
        currentClaimed - n(pendingFalseClaim?.amount)
      );
    }

    playerPlans.push({
      steamId,
      playerName:
        augustBySteam.get(steamId)?.playerName || "Joueur inconnu",
      resetOwnerships,
      uncertainOwnerships,
      falseAmount,
      trueVotes,
      trueAmount,
      claims,
      pendingFalseClaim,
      mode,
      walletBefore: {
        balance: currentBalance,
        lifetimeEarned: currentEarned,
        lifetimeClaimed: currentClaimed,
      },
      walletAfter: {
        balance: targetBalance,
        lifetimeEarned: targetEarned,
        lifetimeClaimed: targetClaimed,
      },
    });
  }

  playerPlans.sort((a, b) => a.playerName.localeCompare(b.playerName));

  return {
    confirmedSteamIds,
    ownershipPlans,
    resetPlans,
    uncertainPlans,
    playerPlans,
  };
}

function validatePlan(plan) {
  const errors = [];

  if (plan.confirmedSteamIds.size !== 9) {
    errors.push(
      `Nombre de joueurs confirmés inattendu: ${plan.confirmedSteamIds.size} (attendu 9)`
    );
  }

  if (plan.ownershipPlans.length !== 23) {
    errors.push(
      `Nombre d'ownerships inattendu: ${plan.ownershipPlans.length} (attendu 23)`
    );
  }

  if (![19, 20, 21, 22, 23].includes(plan.resetPlans.length)) {
    errors.push(
      `Nombre d'ownerships reset incohérent: ${plan.resetPlans.length}`
    );
  }

  const fryt = plan.playerPlans.find(
    (p) => p.playerName.toLowerCase() === "fryt85"
  );

  if (
    !fryt ||
    fryt.mode !== "CANCEL_PENDING_FALSE_CLAIM" ||
    !fryt.pendingFalseClaim ||
    fryt.pendingFalseClaim.amount !== 47000
  ) {
    errors.push(
      "Le cas fryt85 47 000 ₽ pending n'est plus exactement celui attendu."
    );
  }

  for (const player of plan.playerPlans) {
    if (player.mode === "REMOVE_FALSE_FROM_WALLET") {
      if (player.walletBefore.balance < player.falseAmount) {
        errors.push(
          `${player.playerName}: solde inférieur au faux montant à retirer.`
        );
      }
    }

    if (player.walletAfter.balance < 0) {
      errors.push(`${player.playerName}: solde cible négatif.`);
    }

    if (player.walletAfter.lifetimeEarned < 0) {
      errors.push(`${player.playerName}: lifetime_earned cible négatif.`);
    }

    if (player.walletAfter.lifetimeClaimed < 0) {
      errors.push(`${player.playerName}: lifetime_claimed cible négatif.`);
    }
  }

  if (errors.length) {
    const err = new Error(
      "PLAN REFUSE PAR LES GARDE-FOUS:\n- " + errors.join("\n- ")
    );
    err.validationErrors = errors;
    throw err;
  }
}

function printablePlan(plan) {
  const players = plan.playerPlans.map((p) => ({
    joueur: p.playerName,
    mode: p.mode,
    faux_roubles: p.falseAmount,
    vrais_votes_septembre: p.trueVotes,
    roubles_legitimes: p.trueAmount,
    solde_avant: p.walletBefore.balance,
    solde_apres: p.walletAfter.balance,
    lifetime_earned_avant: p.walletBefore.lifetimeEarned,
    lifetime_earned_apres: p.walletAfter.lifetimeEarned,
    lifetime_claimed_avant: p.walletBefore.lifetimeClaimed,
    lifetime_claimed_apres: p.walletAfter.lifetimeClaimed,
    ownerships_reset: p.resetOwnerships.length,
    ownerships_incertains: p.uncertainOwnerships.length,
  }));

  const ownerships = plan.ownershipPlans.map((o) => ({
    joueur: o.playerName,
    alias: o.alias,
    aout: o.augLast,
    septembre_actuel: o.currentSep,
    credited_sept_avant: o.creditedSep,
    faux_roubles: o.falseAmount,
    diagnostic: o.diagnostic,
    ownership: short(o.ownershipId),
  }));

  return { players, ownerships };
}

async function ledgerInsert({
  steamId,
  amount,
  ownershipId = null,
  votes = null,
  key,
  metadata,
}) {
  const body = {
    steam_id: steamId,
    kind: "adjustment",
    amount,
    period: SEPTEMBER_PERIOD,
    ownership_id: ownershipId,
    votes,
    idempotency_key: key,
    metadata,
  };

  await post("vote_wallet_ledger", body);
}

async function trueCreditLedgerInsert({
  steamId,
  ownershipId,
  alias,
  currentVotes,
  amount,
}) {
  if (currentVotes <= 0 || amount <= 0) return;

  await post("vote_wallet_ledger", {
    steam_id: steamId,
    kind: "vote_credit",
    amount,
    period: SEPTEMBER_PERIOD,
    ownership_id: ownershipId,
    votes: currentVotes,
    idempotency_key:
      `repair:${SEPTEMBER_PERIOD}:${ownershipId}:true:${currentVotes}`,
    metadata: {
      alias,
      current_votes: currentVotes,
      repair: "rollover_2026_09",
      reason: "recredit_true_september_votes_after_rollover_repair",
    },
  });
}

async function executePlan(plan) {
  const execution = {
    startedAt: isoNow(),
    players: [],
    ownerships: [],
  };

  // 1) Annulation de la livraison pending de fryt85 avant toute correction wallet.
  const fryt = plan.playerPlans.find(
    (p) => p.mode === "CANCEL_PENDING_FALSE_CLAIM"
  );

  if (fryt?.pendingFalseClaim) {
    const now = isoNow();

    const deliveryRows = await patch(
      `deliveries?id=eq.${encodeURIComponent(
        fryt.pendingFalseClaim.deliveryId
      )}&status=eq.pending`,
      {
        status: "cancelled",
        cancelled_at: now,
        claim_token: null,
        claimed_by: null,
        updated_at: now,
      }
    );

    if (!Array.isArray(deliveryRows) || deliveryRows.length !== 1) {
      throw new Error(
        "Impossible d'annuler exactement la livraison pending attendue de fryt85."
      );
    }

    const claimRows = await patch(
      `vote_wallet_claims?id=eq.${encodeURIComponent(
        fryt.pendingFalseClaim.id
      )}&status=eq.delivery_created`,
      {
        status: "failed",
        updated_at: now,
      }
    );

    if (!Array.isArray(claimRows) || claimRows.length !== 1) {
      throw new Error(
        "Livraison fryt85 annulée, mais impossible de marquer exactement le claim en failed."
      );
    }

    // Neutralise comptablement le claim annulé sans recréditer le faux montant au wallet.
    await ledgerInsert({
      steamId: fryt.steamId,
      amount: fryt.pendingFalseClaim.amount,
      key: `repair:${SEPTEMBER_PERIOD}:cancelled-pending-claim:${fryt.pendingFalseClaim.id}`,
      metadata: {
        repair: "rollover_2026_09",
        reason: "neutralize_cancelled_pending_claim_in_ledger_only",
        amount: fryt.pendingFalseClaim.amount,
      },
    });
  }

  // 2) Réparation de chaque joueur et des ownerships reset confirmés.
  for (const player of plan.playerPlans) {
    if (!player.resetOwnerships.length) continue;

    // Mise à jour wallet calculée à partir de l'état relu juste avant l'exécution.
    const walletRows = await patch(
      `vote_wallets?steam_id=eq.${encodeURIComponent(player.steamId)}`,
      {
        balance: player.walletAfter.balance,
        lifetime_earned: player.walletAfter.lifetimeEarned,
        lifetime_claimed: player.walletAfter.lifetimeClaimed,
        updated_at: isoNow(),
      }
    );

    if (!Array.isArray(walletRows) || walletRows.length !== 1) {
      throw new Error(
        `Impossible de mettre à jour exactement un wallet pour ${player.playerName}.`
      );
    }

    // Audit du faux crédit.
    if (player.mode === "REMOVE_FALSE_FROM_WALLET") {
      await ledgerInsert({
        steamId: player.steamId,
        amount: -player.falseAmount,
        key: `repair:${SEPTEMBER_PERIOD}:false-credit-reversal:${player.steamId}`,
        metadata: {
          repair: "rollover_2026_09",
          reason: "remove_false_rollover_credit_from_available_wallet",
          false_amount: player.falseAmount,
        },
      });
    } else if (player.mode === "CANCEL_PENDING_FALSE_CLAIM") {
      await ledgerInsert({
        steamId: player.steamId,
        amount: -player.falseAmount,
        key: `repair:${SEPTEMBER_PERIOD}:false-credit-reversal:${player.steamId}`,
        metadata: {
          repair: "rollover_2026_09",
          reason: "reverse_false_rollover_credit_after_pending_claim_cancelled",
          false_amount: player.falseAmount,
        },
      });
    } else if (player.mode === "FORGIVE_ALREADY_CLAIMED_FALSE_AMOUNT") {
      await ledgerInsert({
        steamId: player.steamId,
        amount: 0,
        key: `repair:${SEPTEMBER_PERIOD}:forgiven-overpayment:${player.steamId}`,
        metadata: {
          repair: "rollover_2026_09",
          reason: "false_rollover_amount_already_delivered_forgiven",
          false_amount: player.falseAmount,
        },
      });
    }

    // Etat mensuel sain + crédit manuel des vrais votes septembre actuels.
    for (const ownership of player.resetOwnerships) {
      const periodRows = await patch(
        `vote_wallet_alias_periods?ownership_id=eq.${encodeURIComponent(
          ownership.ownershipId
        )}&period=eq.${SEPTEMBER_PERIOD}`,
        {
          baseline_votes: 0,
          credited_votes: ownership.currentSep,
          last_seen_votes: ownership.currentSep,
          updated_at: isoNow(),
        }
      );

      if (!Array.isArray(periodRows) || periodRows.length !== 1) {
        throw new Error(
          `Impossible de réparer exactement un état mensuel pour ${player.playerName}/${ownership.alias}.`
        );
      }

      await trueCreditLedgerInsert({
        steamId: player.steamId,
        ownershipId: ownership.ownershipId,
        alias: ownership.alias,
        currentVotes: ownership.currentSep,
        amount: ownership.currentSep * AMOUNT_PER_VOTE,
      });

      execution.ownerships.push({
        playerName: player.playerName,
        alias: ownership.alias,
        ownershipShort: short(ownership.ownershipId),
        creditedVotesAfter: ownership.currentSep,
        lastSeenVotesAfter: ownership.currentSep,
      });
    }

    execution.players.push({
      playerName: player.playerName,
      mode: player.mode,
      falseAmount: player.falseAmount,
      trueVotes: player.trueVotes,
      trueAmount: player.trueAmount,
      walletAfter: player.walletAfter,
    });
  }

  execution.finishedAt = isoNow();
  return execution;
}

async function verifyAfter(plan) {
  const [wallets, sepPeriods, deliveries, claims] = await Promise.all([
    get(
      "vote_wallets?select=steam_id,balance,lifetime_earned,lifetime_claimed,updated_at"
    ),
    get(
      `vote_wallet_alias_periods?period=eq.${SEPTEMBER_PERIOD}` +
        "&select=ownership_id,baseline_votes,credited_votes,last_seen_votes,updated_at"
    ),
    get(
      "deliveries" +
        "?title=eq." +
        encodeURIComponent("Cagnotte de votes") +
        "&select=id,steam_id,player_name,status,created_at,claimed_at,cancelled_at"
    ),
    get(
      "vote_wallet_claims" +
        "?select=id,steam_id,amount,status,delivery_id,created_at,updated_at"
    ),
  ]);

  const walletBySteam = new Map(
    (wallets || []).map((w) => [String(w.steam_id), w])
  );
  const stateByOwner = new Map(
    (sepPeriods || []).map((p) => [String(p.ownership_id), p])
  );
  const deliveryById = new Map(
    (deliveries || []).map((d) => [String(d.id), d])
  );
  const claimById = new Map(
    (claims || []).map((c) => [String(c.id), c])
  );

  const failures = [];

  for (const player of plan.playerPlans) {
    if (!player.resetOwnerships.length) continue;
    const wallet = walletBySteam.get(player.steamId);

    if (
      !wallet ||
      n(wallet.balance) !== player.walletAfter.balance ||
      n(wallet.lifetime_earned) !== player.walletAfter.lifetimeEarned ||
      n(wallet.lifetime_claimed) !== player.walletAfter.lifetimeClaimed
    ) {
      failures.push(`${player.playerName}: wallet final différent du plan.`);
    }

    for (const ownership of player.resetOwnerships) {
      const state = stateByOwner.get(ownership.ownershipId);
      if (
        !state ||
        n(state.baseline_votes) !== 0 ||
        n(state.credited_votes) !== ownership.currentSep ||
        n(state.last_seen_votes) !== ownership.currentSep
      ) {
        failures.push(
          `${player.playerName}/${ownership.alias}: état septembre final incorrect.`
        );
      }
    }
  }

  const fryt = plan.playerPlans.find(
    (p) => p.mode === "CANCEL_PENDING_FALSE_CLAIM"
  );

  if (fryt?.pendingFalseClaim) {
    const delivery = deliveryById.get(fryt.pendingFalseClaim.deliveryId);
    const claim = claimById.get(fryt.pendingFalseClaim.id);

    if (delivery?.status !== "cancelled") {
      failures.push("fryt85: livraison 47 000 ₽ non cancelled.");
    }
    if (claim?.status !== "failed") {
      failures.push("fryt85: claim 47 000 ₽ non failed.");
    }
  }

  return {
    ok: failures.length === 0,
    failures,
  };
}

function reportFromPlan(plan, execution = null, verification = null) {
  const printable = printablePlan(plan);

  return {
    mode: EXECUTE ? "EXECUTION_REELLE" : "SIMULATION_LECTURE_SEULE",
    generatedAt: isoNow(),
    periods: {
      august: AUGUST_PERIOD,
      september: SEPTEMBER_PERIOD,
      rolloverUtc: ROLLOVER_UTC,
    },
    counts: {
      confirmedPlayers: plan.confirmedSteamIds.size,
      ownershipsExamined: plan.ownershipPlans.length,
      resetConfirmedOwnerships: plan.resetPlans.length,
      uncertainOwnerships: plan.uncertainPlans.length,
    },
    totals: {
      falseRoublesResetConfirmed: sum(plan.resetPlans, (o) => o.falseAmount),
      trueSeptemberVotes: sum(plan.resetPlans, (o) => o.currentSep),
      trueSeptemberRoubles: sum(
        plan.resetPlans,
        (o) => o.currentSep * AMOUNT_PER_VOTE
      ),
    },
    players: printable.players,
    ownerships: printable.ownerships,
    execution,
    verification,
    sensitiveIdsIncluded: false,
  };
}

function printPlan(report) {
  console.log("");
  console.log("==============================================================");
  console.log(" SENZANY — REPARATION CAGNOTTE VOTES SEPTEMBRE 2026");
  console.log("==============================================================");
  console.log("");
  console.log("MODE :", report.mode);
  console.log(
    "Joueurs confirmés :",
    report.counts.confirmedPlayers
  );
  console.log(
    "Ownerships reset confirmés :",
    report.counts.resetConfirmedOwnerships
  );
  console.log(
    "Ownerships incertains laissés intacts :",
    report.counts.uncertainOwnerships
  );
  console.log(
    "Faux roubles concernés :",
    report.totals.falseRoublesResetConfirmed.toLocaleString("fr-FR"),
    "₽"
  );
  console.log(
    "Vrais votes septembre à conserver :",
    report.totals.trueSeptemberVotes
  );
  console.log(
    "Roubles légitimes correspondants :",
    report.totals.trueSeptemberRoubles.toLocaleString("fr-FR"),
    "₽"
  );
  console.log("");

  console.log("=== PLAN PAR JOUEUR ===");
  console.table(report.players);

  console.log("");
  console.log("=== OWNERSHIPS ===");
  console.table(report.ownerships);

  if (report.verification) {
    console.log("");
    console.log(
      "VERIFICATION FINALE :",
      report.verification.ok ? "OK ✅" : "ECHEC ❌"
    );
    if (report.verification.failures?.length) {
      for (const failure of report.verification.failures) {
        console.log("-", failure);
      }
    }
  }

  console.log("");
  console.log("Rapport :", REPORT_PATH);
  console.log("");
}

(async () => {
  try {
    if (EXECUTE && CONFIRM !== CONFIRM_TOKEN) {
      throw new Error(
        `Confirmation invalide. Utiliser --confirm=${CONFIRM_TOKEN}`
      );
    }

    const before = await loadData();
    const plan = buildPlan(before);
    validatePlan(plan);

    let execution = null;
    let verification = null;

    if (EXECUTE) {
      execution = await executePlan(plan);
      verification = await verifyAfter(plan);

      if (!verification.ok) {
        throw new Error(
          "L'exécution a eu lieu mais la vérification finale a détecté un écart. Consulter immédiatement le rapport."
        );
      }
    }

    const report = safeJson(
      reportFromPlan(plan, execution, verification)
    );

    fs.writeFileSync(
      REPORT_PATH,
      JSON.stringify(report, null, 2) + "\n",
      "utf8"
    );

    printPlan(report);

    if (!EXECUTE) {
      console.log(
        `SIMULATION UNIQUEMENT. Pour exécuter réellement : --execute --confirm=${CONFIRM_TOKEN}`
      );
      console.log("");
    }
  } catch (error) {
    console.error("");
    console.error("ECHEC");
    console.error(error?.message || error);

    const failureReport = safeJson({
      mode: EXECUTE ? "EXECUTION_REELLE" : "SIMULATION_LECTURE_SEULE",
      failedAt: isoNow(),
      error: String(error?.message || error),
    });

    try {
      fs.writeFileSync(
        REPORT_PATH,
        JSON.stringify(failureReport, null, 2) + "\n",
        "utf8"
      );
    } catch {}

    process.exitCode = 1;
  }
})();
