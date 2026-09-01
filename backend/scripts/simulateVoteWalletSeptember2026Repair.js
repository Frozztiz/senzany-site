#!/usr/bin/env node
"use strict";

/**
 * Senzany — Simulation de réparation du rollover de la cagnotte de votes
 * Période ciblée : 2026-09
 *
 * IMPORTANT :
 * - Ce script n'effectue AUCUNE écriture dans Supabase.
 * - Il ne modifie ni wallet, ni ledger, ni claim, ni livraison.
 * - Il génère uniquement un rapport local JSON sans SteamID.
 *
 * Exécution recommandée depuis le backend actif :
 *
 *   cd /var/www/senzany/server
 *   NODE_PATH=/var/www/senzany/backend/node_modules \
 *   node /tmp/senzany-dev/backend/scripts/simulateVoteWalletSeptember2026Repair.js
 */

require("dotenv").config();

const path = require("path");
const fs = require("fs");

const supabaseService = require(
  path.resolve(__dirname, "../../backend/services/supabaseService")
);

const AUGUST_RUN_ID = "4ed81efa-ae7a-4f77-adcc-c1b2648c19ca";
const AUGUST_PERIOD = "2026-08";
const SEPTEMBER_PERIOD = "2026-09";
const AMOUNT_PER_VOTE = 1000;
const ROLLOVER_UTC = "2026-08-31T22:00:00.000Z";
const REPORT_PATH = path.resolve(
  process.cwd(),
  "vote-wallet-rollover-simulation-2026-09.json"
);

function num(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function shortId(value) {
  return String(value || "").slice(0, 8);
}

function sum(rows, selector) {
  return rows.reduce((acc, row) => acc + num(selector(row)), 0);
}

function unique(values) {
  return [...new Set(values)];
}

function noSensitiveIds(obj) {
  const blockedKeys = new Set([
    "steam_id",
    "steamId",
    "ownership_id",
    "ownershipId",
    "claim_id",
    "claimId",
    "delivery_id",
    "deliveryId",
  ]);

  if (Array.isArray(obj)) return obj.map(noSensitiveIds);

  if (obj && typeof obj === "object") {
    const out = {};
    for (const [key, value] of Object.entries(obj)) {
      if (blockedKeys.has(key)) continue;
      out[key] = noSensitiveIds(value);
    }
    return out;
  }

  return obj;
}

async function readAll() {
  const [
    august,
    septemberLedger,
    ownerships,
    augustPeriods,
    septemberPeriods,
    wallets,
    claims,
    deliveries,
  ] = await Promise.all([
    supabaseService.request(
      `monthly_vote_rankings?run_id=eq.${AUGUST_RUN_ID}` +
        "&select=steam_id,player_name,votes",
      { method: "GET" }
    ),
    supabaseService.request(
      `vote_wallet_ledger?period=eq.${SEPTEMBER_PERIOD}` +
        "&kind=eq.vote_credit" +
        "&select=steam_id,ownership_id,amount,votes,created_at,idempotency_key,metadata" +
        "&order=created_at.asc",
      { method: "GET" }
    ),
    supabaseService.request(
      "vote_alias_ownerships" +
        "?select=id,steam_id,alias,baseline_period,baseline_votes,created_at,ended_at",
      { method: "GET" }
    ),
    supabaseService.request(
      `vote_wallet_alias_periods?period=eq.${AUGUST_PERIOD}` +
        "&select=ownership_id,baseline_votes,credited_votes,last_seen_votes,updated_at",
      { method: "GET" }
    ),
    supabaseService.request(
      `vote_wallet_alias_periods?period=eq.${SEPTEMBER_PERIOD}` +
        "&select=ownership_id,baseline_votes,credited_votes,last_seen_votes,updated_at",
      { method: "GET" }
    ),
    supabaseService.request(
      "vote_wallets?select=steam_id,balance,lifetime_earned,lifetime_claimed,updated_at",
      { method: "GET" }
    ),
    supabaseService.request(
      "vote_wallet_claims" +
        "?select=id,steam_id,amount,status,delivery_id,created_at,updated_at" +
        "&order=created_at.asc",
      { method: "GET" }
    ),
    supabaseService.request(
      "deliveries" +
        "?title=eq." +
        encodeURIComponent("Cagnotte de votes") +
        "&select=id,steam_id,player_name,status,created_at,claimed_at,cancelled_at" +
        "&order=created_at.asc",
      { method: "GET" }
    ),
  ]);

  return {
    august: Array.isArray(august) ? august : [],
    septemberLedger: Array.isArray(septemberLedger) ? septemberLedger : [],
    ownerships: Array.isArray(ownerships) ? ownerships : [],
    augustPeriods: Array.isArray(augustPeriods) ? augustPeriods : [],
    septemberPeriods: Array.isArray(septemberPeriods) ? septemberPeriods : [],
    wallets: Array.isArray(wallets) ? wallets : [],
    claims: Array.isArray(claims) ? claims : [],
    deliveries: Array.isArray(deliveries) ? deliveries : [],
  };
}

function buildSimulation(data) {
  const augustBySteam = new Map();
  for (const row of data.august) {
    if (!row.steam_id) continue;
    augustBySteam.set(String(row.steam_id), {
      playerName: row.player_name || "Joueur inconnu",
      votes: num(row.votes),
    });
  }

  const septemberVotesBySteam = new Map();
  for (const row of data.septemberLedger) {
    if (!row.steam_id) continue;
    const steamId = String(row.steam_id);
    septemberVotesBySteam.set(
      steamId,
      (septemberVotesBySteam.get(steamId) || 0) + num(row.votes)
    );
  }

  // Même détecteur que l'audit manuel :
  // total vote_credit septembre == snapshot final août.
  const confirmedSteamIds = new Set();
  for (const [steamId, septemberVotes] of septemberVotesBySteam.entries()) {
    const aug = augustBySteam.get(steamId);
    if (aug && aug.votes > 0 && septemberVotes === aug.votes) {
      confirmedSteamIds.add(steamId);
    }
  }

  const ownerById = new Map(
    data.ownerships.map((row) => [String(row.id), row])
  );
  const augustPeriodByOwnership = new Map(
    data.augustPeriods.map((row) => [String(row.ownership_id), row])
  );
  const septemberPeriodByOwnership = new Map(
    data.septemberPeriods.map((row) => [String(row.ownership_id), row])
  );
  const walletBySteam = new Map(
    data.wallets.map((row) => [String(row.steam_id), row])
  );
  const deliveryById = new Map(
    data.deliveries.map((row) => [String(row.id), row])
  );

  const confirmedOwnershipIds = unique(
    data.septemberLedger
      .filter((row) => confirmedSteamIds.has(String(row.steam_id)))
      .map((row) => String(row.ownership_id))
  );

  const ownershipRows = [];

  for (const ownershipId of confirmedOwnershipIds) {
    const owner = ownerById.get(ownershipId);
    if (!owner) continue;

    const augState = augustPeriodByOwnership.get(ownershipId);
    const sepState = septemberPeriodByOwnership.get(ownershipId);

    const augLast = num(augState?.last_seen_votes);
    const sepLast = num(sepState?.last_seen_votes);
    const creditedSepState = num(sepState?.credited_votes);

    let diagnostic = "PAS_ETAT_AOUT";
    let resetConfirmed = false;

    if (augState) {
      if (sepLast < augLast) {
        diagnostic = "RESET_CONFIRME";
        resetConfirmed = true;
      } else if (sepLast === augLast) {
        diagnostic = "RESET_NON_CONFIRME";
      } else {
        diagnostic = "COMPTEUR_SUPERIEUR";
      }
    }

    const ledgerRows = data.septemberLedger.filter(
      (row) => String(row.ownership_id) === ownershipId
    );

    const falseVotesLedger = sum(ledgerRows, (row) => row.votes);
    const falseAmountLedger = sum(ledgerRows, (row) => row.amount);

    ownershipRows.push({
      playerName:
        augustBySteam.get(String(owner.steam_id))?.playerName ||
        "Joueur inconnu",
      alias: owner.alias || "???",
      ownershipShort: shortId(ownershipId),
      augustLastSeenVotes: augLast,
      septemberCurrentCounter: sepLast,
      septemberCreditedState: creditedSepState,
      falseVotesInLedger: falseVotesLedger,
      falseAmountInLedger: falseAmountLedger,
      resetConfirmed,
      diagnostic,
      proposedStateIfRepaired: resetConfirmed
        ? {
            baselineVotes: 0,
            creditedVotesBeforeTrueRecredit: 0,
            lastSeenVotes: sepLast,
            trueVotesToCreditAfterRepair: sepLast,
            trueAmountToCreditAfterRepair: sepLast * AMOUNT_PER_VOTE,
          }
        : null,
    });
  }

  const confirmedResetRows = ownershipRows.filter(
    (row) => row.resetConfirmed
  );
  const uncertainRows = ownershipRows.filter((row) => !row.resetConfirmed);

  const players = [];

  for (const steamId of confirmedSteamIds) {
    const playerName =
      augustBySteam.get(steamId)?.playerName || "Joueur inconnu";
    const playerOwnerships = ownershipRows.filter(
      (row) => row.playerName === playerName
    );

    const resetOwnerships = playerOwnerships.filter(
      (row) => row.resetConfirmed
    );
    const uncertainOwnerships = playerOwnerships.filter(
      (row) => !row.resetConfirmed
    );

    const wallet = walletBySteam.get(steamId);

    const playerClaims = data.claims.filter(
      (claim) =>
        String(claim.steam_id) === steamId &&
        String(claim.created_at || "") >= ROLLOVER_UTC
    );

    const claimDetails = playerClaims.map((claim) => {
      const delivery = deliveryById.get(String(claim.delivery_id));
      return {
        amount: num(claim.amount),
        claimStatus: claim.status || null,
        deliveryStatus: delivery?.status || null,
        playerName: delivery?.player_name || playerName,
        createdAt: claim.created_at || null,
        claimedAt: delivery?.claimed_at || null,
        cancelledAt: delivery?.cancelled_at || null,
        claimShort: shortId(claim.id),
        deliveryShort: shortId(claim.delivery_id),
      };
    });

    players.push({
      playerName,
      falseVotesConfirmedReset: sum(
        resetOwnerships,
        (row) => row.falseVotesInLedger
      ),
      falseAmountConfirmedReset: sum(
        resetOwnerships,
        (row) => row.falseAmountInLedger
      ),
      trueSeptemberVotesCurrentlyVisible: sum(
        resetOwnerships,
        (row) => row.septemberCurrentCounter
      ),
      trueSeptemberAmountToRestore: sum(
        resetOwnerships,
        (row) => row.septemberCurrentCounter * AMOUNT_PER_VOTE
      ),
      currentWalletBalance: num(wallet?.balance),
      currentLifetimeEarned: num(wallet?.lifetime_earned),
      currentLifetimeClaimed: num(wallet?.lifetime_claimed),
      resetOwnershipCount: resetOwnerships.length,
      uncertainOwnershipCount: uncertainOwnerships.length,
      claimsSinceRollover: claimDetails,
    });
  }

  players.sort((a, b) => a.playerName.localeCompare(b.playerName));
  ownershipRows.sort(
    (a, b) =>
      a.playerName.localeCompare(b.playerName) ||
      a.alias.localeCompare(b.alias)
  );

  const frytCandidate = players.find(
    (p) =>
      p.playerName.toLowerCase() === "fryt85" &&
      p.claimsSinceRollover.some(
        (claim) =>
          claim.amount === 47000 &&
          claim.claimStatus === "delivery_created" &&
          claim.deliveryStatus === "pending"
      )
  );

  return {
    mode: "SIMULATION_LECTURE_SEULE",
    generatedAt: new Date().toISOString(),
    periods: {
      august: AUGUST_PERIOD,
      september: SEPTEMBER_PERIOD,
      rolloverUtc: ROLLOVER_UTC,
    },
    safeguards: {
      supabaseWrites: false,
      walletWrites: false,
      ledgerWrites: false,
      claimWrites: false,
      deliveryWrites: false,
      steamIdsIncludedInReport: false,
    },
    detection: {
      confirmedPlayers: confirmedSteamIds.size,
      ownershipsExamined: ownershipRows.length,
      resetConfirmedOwnerships: confirmedResetRows.length,
      uncertainOwnerships: uncertainRows.length,
    },
    totals: {
      falseVotesOnResetConfirmedOwnerships: sum(
        confirmedResetRows,
        (row) => row.falseVotesInLedger
      ),
      falseRoublesOnResetConfirmedOwnerships: sum(
        confirmedResetRows,
        (row) => row.falseAmountInLedger
      ),
      trueSeptemberVotesCurrentlyVisible: sum(
        confirmedResetRows,
        (row) => row.septemberCurrentCounter
      ),
      trueSeptemberRoublesToRestore: sum(
        confirmedResetRows,
        (row) => row.septemberCurrentCounter * AMOUNT_PER_VOTE
      ),
    },
    fryt85Pending47000Detected: Boolean(frytCandidate),
    players,
    ownerships: ownershipRows,
    notes: [
      "Aucune écriture Supabase n'est effectuée par ce script.",
      "Les ownerships dont le reset n'est pas confirmé sont uniquement signalés et ne doivent pas être réparés automatiquement.",
      "Le solde wallet courant est affiché à titre d'audit : cette simulation ne suppose pas que tout le solde courant correspond au faux crédit.",
      "Les montants déjà livrés/récupérés ne sont pas automatiquement déduits dans cette simulation.",
      "Le cas fryt85 est seulement détecté ; sa livraison pending n'est pas annulée par ce script.",
    ],
  };
}

function printSummary(report) {
  console.log("");
  console.log("============================================================");
  console.log(" SENZANY — SIMULATION REPARATION CAGNOTTE SEPTEMBRE 2026");
  console.log("============================================================");
  console.log("");
  console.log("MODE :", report.mode);
  console.log("ECRITURES SUPABASE : NON");
  console.log("");
  console.log("Joueurs confirmés :", report.detection.confirmedPlayers);
  console.log(
    "Ownerships reset confirmés :",
    report.detection.resetConfirmedOwnerships
  );
  console.log(
    "Ownerships encore incertains :",
    report.detection.uncertainOwnerships
  );
  console.log("");
  console.log(
    "Faux votes sur ownerships reset confirmés :",
    report.totals.falseVotesOnResetConfirmedOwnerships
  );
  console.log(
    "Faux roubles correspondants :",
    report.totals.falseRoublesOnResetConfirmedOwnerships.toLocaleString("fr-FR"),
    "₽"
  );
  console.log(
    "Vrais votes septembre actuellement visibles :",
    report.totals.trueSeptemberVotesCurrentlyVisible
  );
  console.log(
    "Roubles légitimes à restaurer ensuite :",
    report.totals.trueSeptemberRoublesToRestore.toLocaleString("fr-FR"),
    "₽"
  );
  console.log("");
  console.log(
    "Livraison fryt85 47 000 ₽ pending détectée :",
    report.fryt85Pending47000Detected ? "OUI" : "NON"
  );
  console.log("");

  console.log("=== PAR JOUEUR ===");
  console.table(
    report.players.map((p) => ({
      joueur: p.playerName,
      faux_roubles_reset_confirme: p.falseAmountConfirmedReset,
      vrais_votes_septembre: p.trueSeptemberVotesCurrentlyVisible,
      roubles_legitimes_a_restaurer: p.trueSeptemberAmountToRestore,
      solde_wallet_actuel: p.currentWalletBalance,
      ownerships_reset: p.resetOwnershipCount,
      ownerships_incertains: p.uncertainOwnershipCount,
      claims_depuis_rollover: p.claimsSinceRollover.length,
    }))
  );

  console.log("");
  console.log("=== OWNERSHIPS ===");
  console.table(
    report.ownerships.map((o) => ({
      joueur: o.playerName,
      alias: o.alias,
      aout: o.augustLastSeenVotes,
      septembre_actuel: o.septemberCurrentCounter,
      credited_sept: o.septemberCreditedState,
      faux_roubles: o.falseAmountInLedger,
      diagnostic: o.diagnostic,
      ownership: o.ownershipShort,
    }))
  );

  console.log("");
  console.log("Rapport JSON :", REPORT_PATH);
  console.log("");
}

(async () => {
  try {
    const data = await readAll();
    const report = buildSimulation(data);
    const safeReport = noSensitiveIds(report);

    fs.writeFileSync(
      REPORT_PATH,
      JSON.stringify(safeReport, null, 2) + "\n",
      "utf8"
    );

    printSummary(safeReport);
  } catch (error) {
    console.error("");
    console.error("ECHEC DE LA SIMULATION");
    console.error(error);
    process.exitCode = 1;
  }
})();
