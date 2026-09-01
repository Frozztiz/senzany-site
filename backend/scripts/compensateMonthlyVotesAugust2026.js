#!/usr/bin/env node
"use strict";

/**
 * Rattrapage exceptionnel des paliers cumulés - Août 2026.
 *
 * IMPORTANT :
 * - Par défaut ce script est en SIMULATION : aucune livraison n'est créée.
 * - Il utilise uniquement le snapshot mensuel déjà archivé en base.
 * - Il NE recalcule PAS le classement Top-Serveurs.
 * - Il ne recrédite PAS le palier le plus haut déjà livré.
 * - Il ne crédite PAS l'XP Battle Pass.
 * - Il est idempotent : une livraison de rattrapage déjà existante est détectée.
 *
 * Simulation :
 *   node scripts/compensateMonthlyVotesAugust2026.js
 *
 * Exécution réelle (seulement après validation de la simulation) :
 *   node scripts/compensateMonthlyVotesAugust2026.js --execute --confirm=AOUT-2026-CUMULATIF
 */

require("dotenv").config();

const supabaseService = require("../services/supabaseService");
const rewardRuleService = require("../services/rewardRuleService");
const deliveryService = require("../services/deliveryService");

const PERIOD = "2026-08";
const RUNS_TABLE = "monthly_vote_runs";
const RANKINGS_TABLE = "monthly_vote_rankings";
const BANK_CREDIT_CLASSNAME = "SenzanyBankCredit";
const BITCOIN_CLASSNAME = "bitcoin";
const DELIVERY_TITLE = `Rattrapage paliers cumulés votes ${PERIOD}`;
const EXECUTION_CONFIRMATION = "AOUT-2026-CUMULATIF";

const args = new Set(process.argv.slice(2));
const execute = args.has("--execute");
const confirmationArg = process.argv
  .slice(2)
  .find((value) => value.startsWith("--confirm="));
const confirmation = confirmationArg ? confirmationArg.slice("--confirm=".length) : "";

function toInt(value) {
  return Math.max(0, Number.parseInt(value, 10) || 0);
}

function normalizeItems(items) {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => ({
      className: String(item?.classname || item?.className || "").trim(),
      name: String(
        item?.displayName ||
        item?.name ||
        item?.classname ||
        item?.className ||
        ""
      ).trim(),
      quantity: Math.max(1, Number.parseInt(item?.quantity, 10) || 1),
    }))
    .filter((item) => item.className);
}

function appendSplitItem(items, className, name, quantity, maxPerLine) {
  let remaining = toInt(quantity);
  while (remaining > 0) {
    const chunk = Math.min(remaining, maxPerLine);
    items.push({ className, name, quantity: chunk });
    remaining -= chunk;
  }
}

function aggregateRules(rules) {
  const result = {
    items: [],
    roubles: 0,
    bitcoinAmount: 0,
    battlePassXpIgnored: 0,
    thresholds: [],
    ruleIds: [],
    ruleNames: [],
  };

  for (const rule of rules) {
    result.items.push(...normalizeItems(rule.items));
    result.roubles += toInt(rule.roubles);
    result.bitcoinAmount += toInt(rule.bitcoin_amount);
    result.battlePassXpIgnored += toInt(rule.battle_pass_xp);
    result.thresholds.push(toInt(rule.threshold_value));
    result.ruleIds.push(rule.id);
    result.ruleNames.push(String(rule.name || `Palier ${rule.threshold_value}`));
  }

  return result;
}

function buildDeliveryItems(reward) {
  const items = [...reward.items];

  if (reward.roubles > 0) {
    items.push({
      className: BANK_CREDIT_CLASSNAME,
      name: "Crédit bancaire",
      quantity: reward.roubles,
    });
  }

  // Le PBO stable sait appliquer SetQuantity sur chaque ligne Bitcoin.
  // On découpe donc côté backend en piles de 500 maximum.
  if (reward.bitcoinAmount > 0) {
    appendSplitItem(
      items,
      BITCOIN_CLASSNAME,
      "Bitcoin",
      reward.bitcoinAmount,
      500
    );
  }

  return items;
}

async function getAugustRun() {
  const rows = await supabaseService.request(
    `${RUNS_TABLE}?period=eq.${encodeURIComponent(PERIOD)}` +
      "&select=id,period,status,ranking_count,delivery_count,completed_at&limit=1",
    { method: "GET" }
  );
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function getAugustRankings(runId) {
  const rows = await supabaseService.request(
    `${RANKINGS_TABLE}?run_id=eq.${encodeURIComponent(runId)}` +
      "&select=id,position,steam_id,player_name,votes,reward_rule_id,reward_name,reward_snapshot,delivery_id,status" +
      "&order=position.asc",
    { method: "GET" }
  );
  return Array.isArray(rows) ? rows : [];
}

async function existingCompensation(steamId) {
  const rows = await supabaseService.request(
    "deliveries" +
      `?steam_id=eq.${encodeURIComponent(steamId)}` +
      `&title=eq.${encodeURIComponent(DELIVERY_TITLE)}` +
      "&select=id,status,created_at&order=created_at.desc&limit=1",
    { method: "GET" }
  );
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("fr-FR");
}

function buildMessage(row, deliveredRule, missingRules, reward) {
  const thresholds = missingRules
    .map((rule) => toInt(rule.threshold_value))
    .join(" + ");

  const parts = [
    `Rattrapage exceptionnel des paliers cumulés d'août 2026.`,
    `${row.votes} votes.`,
    `Palier déjà reçu : ${toInt(deliveredRule.threshold_value)}.`,
    `Paliers ajoutés : ${thresholds}.`,
  ];

  if (reward.roubles > 0) {
    parts.push(`Roubles supplémentaires : ${reward.roubles}.`);
  }
  if (reward.bitcoinAmount > 0) {
    parts.push(`Bitcoin supplémentaires : ${reward.bitcoinAmount}.`);
  }

  // L'XP BP est volontairement ignorée tant que le Battle Pass n'est pas validé.
  return parts.join(" ").slice(0, 500);
}

async function main() {
  if (execute && confirmation !== EXECUTION_CONFIRMATION) {
    throw new Error(
      `Exécution refusée. Utiliser --execute --confirm=${EXECUTION_CONFIRMATION}`
    );
  }

  console.log("");
  console.log("============================================================");
  console.log(" SENZANY - RATTRAPAGE PALIERS CUMULÉS - AOÛT 2026");
  console.log(` MODE : ${execute ? "EXÉCUTION RÉELLE" : "SIMULATION - AUCUNE LIVRAISON"}`);
  console.log("============================================================");
  console.log("");

  const run = await getAugustRun();
  if (!run) {
    throw new Error(`Aucun snapshot mensuel trouvé pour ${PERIOD}.`);
  }

  // Protection : on ne travaille que sur le run d'août déjà terminé.
  if (run.status !== "completed") {
    throw new Error(
      `Le run ${PERIOD} n'est pas terminé (statut actuel : ${run.status}).`
    );
  }

  const [rankings, allRules] = await Promise.all([
    getAugustRankings(run.id),
    rewardRuleService.list(),
  ]);

  const ruleById = new Map(
    (Array.isArray(allRules) ? allRules : []).map((rule) => [String(rule.id), rule])
  );

  const activeThresholdRules = (Array.isArray(allRules) ? allRules : [])
    .filter((rule) => (
      rule.is_active !== false &&
      rule.reward_type === "votes_threshold" &&
      toInt(rule.threshold_value) > 0
    ))
    .sort((a, b) => (
      toInt(a.threshold_value) - toInt(b.threshold_value) ||
      toInt(a.priority || 100) - toInt(b.priority || 100)
    ));

  let eligible = 0;
  let wouldCreate = 0;
  let created = 0;
  let skippedNoSteam = 0;
  let skippedNoOriginalDelivery = 0;
  let skippedNoRule = 0;
  let skippedNoMissing = 0;
  let skippedExisting = 0;
  let failed = 0;

  const report = [];

  for (const row of rankings) {
    if (!row.steam_id) {
      skippedNoSteam += 1;
      continue;
    }

    // On compense seulement les joueurs ayant réellement reçu leur récompense d'août.
    if (!row.delivery_id) {
      skippedNoOriginalDelivery += 1;
      continue;
    }

    if (!row.reward_rule_id) {
      skippedNoRule += 1;
      continue;
    }

    const deliveredRule = ruleById.get(String(row.reward_rule_id));
    if (!deliveredRule) {
      skippedNoRule += 1;
      report.push({
        position: row.position,
        playerName: row.player_name,
        votes: row.votes,
        status: "IGNORÉ - règle déjà livrée introuvable",
        deliveredRuleId: row.reward_rule_id,
      });
      continue;
    }

    const deliveredThreshold = toInt(deliveredRule.threshold_value);
    if (!deliveredThreshold) {
      skippedNoRule += 1;
      continue;
    }

    // Important : uniquement les paliers INFÉRIEURS au palier déjà livré.
    // Le palier principal d'août n'est jamais recrédité.
    const missingRules = activeThresholdRules.filter((rule) => {
      const threshold = toInt(rule.threshold_value);
      return threshold < deliveredThreshold && threshold <= toInt(row.votes);
    });

    if (!missingRules.length) {
      skippedNoMissing += 1;
      continue;
    }

    eligible += 1;
    const reward = aggregateRules(missingRules);
    const deliveryItems = buildDeliveryItems(reward);

    // L'XP Battle Pass n'est volontairement jamais transformée en livraison.
    if (!deliveryItems.length) {
      skippedNoMissing += 1;
      continue;
    }

    const existing = await existingCompensation(String(row.steam_id));
    if (existing) {
      skippedExisting += 1;
      report.push({
        position: row.position,
        playerName: row.player_name,
        votes: row.votes,
        status: "DÉJÀ COMPENSÉ",
        existingDeliveryId: existing.id,
        deliveredThreshold,
        missingThresholds: reward.thresholds,
      });
      continue;
    }

    wouldCreate += 1;

    const reportRow = {
      position: row.position,
      playerName: row.player_name,
      votes: toInt(row.votes),
      status: execute ? "À CRÉER" : "SIMULATION",
      deliveredThreshold,
      missingThresholds: reward.thresholds,
      roubles: reward.roubles,
      bitcoin: reward.bitcoinAmount,
      battlePassXpIgnored: reward.battlePassXpIgnored,
      items: reward.items.map((item) => ({
        className: item.className,
        quantity: item.quantity,
      })),
    };

    if (!execute) {
      report.push(reportRow);
      console.log(
        `#${String(row.position).padStart(3, " ")} ${row.player_name} — ${row.votes} votes`
      );
      console.log(
        `   déjà reçu : palier ${deliveredThreshold} | manque : ${reward.thresholds.join(" + ")}`
      );
      console.log(
        `   compensation : ${formatNumber(reward.roubles)} ₽ | ${reward.bitcoinAmount} BTC | ${reward.items.length} ligne(s) objet`
      );
      if (reward.battlePassXpIgnored > 0) {
        console.log(
          `   BP XP ignorée volontairement : ${reward.battlePassXpIgnored}`
        );
      }
      console.log("");
      continue;
    }

    try {
      const delivery = await deliveryService.createDelivery({
        steamId: String(row.steam_id),
        playerName: row.player_name,
        title: DELIVERY_TITLE,
        message: buildMessage(row, deliveredRule, missingRules, reward),
        items: deliveryItems,
        createdBy: null,
        createdByName: "Rattrapage automatique votes août 2026",
      });

      created += 1;
      reportRow.status = "CRÉÉ";
      reportRow.deliveryId = delivery.id;
      report.push(reportRow);

      console.log(
        `[OK] ${row.player_name} — compensation créée (${reward.thresholds.join(" + ")})`
      );
    } catch (error) {
      failed += 1;
      reportRow.status = "ÉCHEC";
      reportRow.error = String(error?.message || error);
      report.push(reportRow);
      console.error(`[ERREUR] ${row.player_name} :`, error?.data || error);
    }
  }

  console.log("");
  console.log("========================= RÉSUMÉ =========================");
  console.log(`Run : ${run.id}`);
  console.log(`Joueurs du snapshot : ${rankings.length}`);
  console.log(`Éligibles à un rattrapage : ${eligible}`);
  console.log(`Livraisons ${execute ? "à traiter" : "qui seraient créées"} : ${wouldCreate}`);
  if (execute) console.log(`Livraisons créées : ${created}`);
  console.log(`Déjà compensés : ${skippedExisting}`);
  console.log(`Sans SteamID : ${skippedNoSteam}`);
  console.log(`Sans livraison août : ${skippedNoOriginalDelivery}`);
  console.log(`Sans règle exploitable : ${skippedNoRule}`);
  console.log(`Aucun palier inférieur manquant : ${skippedNoMissing}`);
  console.log(`Échecs : ${failed}`);
  console.log("Battle Pass XP : NON CRÉDITÉE");
  console.log("==========================================================");
  console.log("");

  // Le rapport ne contient volontairement pas les SteamID.
  const reportFile = `monthly-vote-compensation-${PERIOD}-${execute ? "execute" : "simulation"}.json`;
  require("fs").writeFileSync(
    reportFile,
    JSON.stringify(
      {
        period: PERIOD,
        mode: execute ? "execute" : "simulation",
        generatedAt: new Date().toISOString(),
        summary: {
          rankings: rankings.length,
          eligible,
          wouldCreate,
          created,
          skippedExisting,
          skippedNoSteam,
          skippedNoOriginalDelivery,
          skippedNoRule,
          skippedNoMissing,
          failed,
        },
        rows: report,
      },
      null,
      2
    ),
    "utf8"
  );

  console.log(`Rapport enregistré : ${reportFile}`);
  console.log("");

  if (failed > 0) process.exitCode = 2;
}

main().catch((error) => {
  console.error("");
  console.error("[RATTRAPAGE AOÛT] ARRÊT :", error?.data || error);
  console.error("");
  process.exitCode = 1;
});
