const supabaseService = require("./supabaseService");
const rewardRuleService = require("./rewardRuleService");
const deliveryService = require("./deliveryService");
const voteSuspensionService = require("./voteSuspensionService");

const RUNS_TABLE = "monthly_vote_runs";
const RANKINGS_TABLE = "monthly_vote_rankings";
const TRACKING_TABLE = "monthly_ranking_reward_deliveries";
const BANK_CREDIT_CLASSNAME = "SenzanyBankCredit";
const BITCOIN_CLASSNAME = "bitcoin";
const TOP_LIMIT = 10;

function validatePeriod(period) {
  const value = String(period || "").trim();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) {
    const error = new Error("Période invalide. Format attendu : AAAA-MM.");
    error.status = 400;
    throw error;
  }
  return value;
}

function normalizeItems(items) {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => ({
      className: String(item?.classname || item?.className || "").trim(),
      name: String(item?.displayName || item?.name || item?.classname || item?.className || "").trim(),
      quantity: Math.max(1, Number.parseInt(item?.quantity, 10) || 1),
    }))
    .filter((item) => item.className);
}

function appendSplitItem(items, className, name, quantity, maxPerLine = 500) {
  let remaining = Math.max(0, Number.parseInt(quantity, 10) || 0);
  while (remaining > 0) {
    const chunk = Math.min(remaining, maxPerLine);
    items.push({ className, name, quantity: chunk });
    remaining -= chunk;
  }
}

function snapshotRule(rule) {
  if (!rule) return null;
  return {
    id: rule.id,
    name: rule.name || `Top ${rule.rank_min || 1}`,
    description: rule.description || "",
    rankMin: Number(rule.rank_min || 1),
    rankMax: Number(rule.rank_max || rule.rank_min || 1),
    priority: Number(rule.priority || 100),
    roubles: Math.max(0, Number(rule.roubles || 0)),
    bitcoinAmount: Math.max(0, Number(rule.bitcoin_amount || 0)),
    battlePassXp: Math.max(0, Number(rule.battle_pass_xp || 0)),
    items: normalizeItems(rule.items),
  };
}

function deliveryItemsFromReward(reward) {
  const items = normalizeItems(reward?.items);
  const roubles = Math.max(0, Number(reward?.roubles || 0));
  if (roubles > 0) {
    items.push({
      className: BANK_CREDIT_CLASSNAME,
      name: "Crédit bancaire",
      quantity: roubles,
    });
  }
  const bitcoin = Math.max(0, Number(reward?.bitcoinAmount || 0));
  if (bitcoin > 0) appendSplitItem(items, BITCOIN_CLASSNAME, "Bitcoin", bitcoin, 500);
  return items;
}

function findRankingRule(rules, position) {
  const rank = Number(position || 0);
  return (Array.isArray(rules) ? rules : [])
    .filter((rule) => {
      const min = Number(rule.rank_min || 0);
      const max = Number(rule.rank_max || min);
      return rule.is_active !== false && rule.reward_type === "votes_ranking" && min > 0 && rank >= min && rank <= max;
    })
    .sort((a, b) => {
      const widthA = Number(a.rank_max || a.rank_min || 0) - Number(a.rank_min || 0);
      const widthB = Number(b.rank_max || b.rank_min || 0) - Number(b.rank_min || 0);
      if (widthA !== widthB) return widthA - widthB;
      return Number(a.priority || 100) - Number(b.priority || 100);
    })[0] || null;
}

async function getRunByPeriod(periodInput) {
  const period = validatePeriod(periodInput);
  const rows = await supabaseService.request(
    `${RUNS_TABLE}?period=eq.${encodeURIComponent(period)}` +
      "&select=id,period,year,month,status,snapshot_at,ranking_count,delivery_count,created_at,updated_at&limit=1",
    { method: "GET" }
  );
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function listTopRankings(runId) {
  const rows = await supabaseService.request(
    `${RANKINGS_TABLE}?run_id=eq.${encodeURIComponent(runId)}` +
      `&position=lte.${TOP_LIMIT}` +
      "&select=id,run_id,position,steam_id,player_name,votes,aliases&order=position.asc",
    { method: "GET" }
  );
  return Array.isArray(rows) ? rows : [];
}

async function listTracking(period) {
  const rows = await supabaseService.request(
    `${TRACKING_TABLE}?period=eq.${encodeURIComponent(validatePeriod(period))}` +
      "&select=id,period,ranking_run_id,ranking_row_id,position,steam_id,player_name,reward_rule_id,reward_name,reward_snapshot,delivery_id,status,error_message,created_at,updated_at&order=position.asc",
    { method: "GET" }
  );
  return Array.isArray(rows) ? rows : [];
}

function trackingByPosition(rows) {
  return new Map((Array.isArray(rows) ? rows : []).map((row) => [Number(row.position), row]));
}

function mapPreviewRow(row, rule, tracking, suspension) {
  const reward = snapshotRule(rule);
  let status = "ready";
  let errorMessage = null;
  if (tracking?.status === "delivery_created" && tracking.delivery_id) status = "sent";
  else if (tracking?.status === "blocked") {
    status = "suspended";
    errorMessage = tracking.error_message || "Récompense bloquée lors de la distribution.";
  } else if (tracking?.status === "processing") status = "processing";
  else if (tracking?.status === "failed") {
    status = "failed";
    errorMessage = tracking.error_message || "La précédente tentative a échoué.";
  } else if (!row.steam_id) {
    status = "unidentified";
    errorMessage = "Le joueur n’est pas rattaché à un SteamID Senzany.";
  } else if (suspension?.block_rewards) {
    status = "suspended";
    errorMessage = `Récompenses suspendues jusqu’au ${suspension.ends_at}.`;
  } else if (!reward) {
    status = "no_reward";
    errorMessage = `Aucun pack « Classement mensuel » ne couvre le rang #${row.position}.`;
  } else if (!deliveryItemsFromReward(reward).length) {
    status = "no_items";
    errorMessage = "Le pack ne contient aucun objet, rouble ou Bitcoin à livrer.";
  }

  return {
    rankingRowId: row.id,
    position: Number(row.position || 0),
    steamId: row.steam_id || null,
    playerName: row.player_name || null,
    votes: Number(row.votes || 0),
    aliases: Array.isArray(row.aliases) ? row.aliases : [],
    reward,
    status,
    errorMessage,
    deliveryId: tracking?.delivery_id || null,
  };
}

async function preview(periodInput) {
  const period = validatePeriod(periodInput);
  const run = await getRunByPeriod(period);
  if (!run) {
    return { period, run: null, rankings: [], summary: { ready: 0, sent: 0, failed: 0, blocked: 0 } };
  }

  const [rankings, rules, tracking] = await Promise.all([
    listTopRankings(run.id),
    rewardRuleService.list(),
    listTracking(period),
  ]);
  const tracked = trackingByPosition(tracking);

  const rows = [];
  for (const row of rankings) {
    const existing = tracked.get(Number(row.position));
    let suspension = null;
    if (row.steam_id && existing?.status !== "delivery_created") {
      suspension = await voteSuspensionService.getActive(row.steam_id).catch(() => null);
    }
    rows.push(mapPreviewRow(row, findRankingRule(rules, row.position), existing, suspension));
  }

  const summary = {
    ready: rows.filter((row) => row.status === "ready").length,
    sent: rows.filter((row) => row.status === "sent").length,
    failed: rows.filter((row) => row.status === "failed").length,
    blocked: rows.filter((row) => ["unidentified", "no_reward", "no_items", "suspended", "processing"].includes(row.status)).length,
  };

  return { period, run, rankings: rows, summary };
}

async function reserveTracking({ period, run, row }) {
  const reward = row.reward;
  const now = new Date().toISOString();
  const existingRows = await supabaseService.request(
    `${TRACKING_TABLE}?period=eq.${encodeURIComponent(period)}&position=eq.${row.position}` +
      "&select=id,status,delivery_id,error_message&limit=1",
    { method: "GET" }
  );
  const existing = Array.isArray(existingRows) && existingRows.length ? existingRows[0] : null;

  if (existing?.status === "delivery_created" && existing.delivery_id) return { skip: true, tracking: existing };
  if (existing?.status === "processing") return { skip: true, tracking: existing };

  const payload = {
    period,
    ranking_run_id: run.id,
    ranking_row_id: row.rankingRowId,
    position: row.position,
    steam_id: row.steamId,
    player_name: row.playerName,
    reward_rule_id: reward?.id || null,
    reward_name: reward?.name || null,
    reward_snapshot: reward,
    delivery_id: null,
    status: "processing",
    error_message: null,
    updated_at: now,
  };

  if (existing?.id) {
    const updated = await supabaseService.request(`${TRACKING_TABLE}?id=eq.${encodeURIComponent(existing.id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(payload),
    });
    return { skip: false, tracking: Array.isArray(updated) ? updated[0] : updated };
  }

  try {
    const created = await supabaseService.request(TRACKING_TABLE, {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(payload),
    });
    return { skip: false, tracking: Array.isArray(created) ? created[0] : created };
  } catch (error) {
    // La contrainte UNIQUE(period, position) protège aussi les doubles clics concurrents.
    const afterConflict = await supabaseService.request(
      `${TRACKING_TABLE}?period=eq.${encodeURIComponent(period)}&position=eq.${row.position}` +
        "&select=id,status,delivery_id,error_message&limit=1",
      { method: "GET" }
    ).catch(() => []);
    if (Array.isArray(afterConflict) && afterConflict.length) return { skip: true, tracking: afterConflict[0] };
    throw error;
  }
}

async function persistBlockedTracking({ period, run, row }) {
  const now = new Date().toISOString();
  const payload = {
    period,
    ranking_run_id: run.id,
    ranking_row_id: row.rankingRowId,
    position: row.position,
    steam_id: row.steamId,
    player_name: row.playerName,
    reward_rule_id: row.reward?.id || null,
    reward_name: row.reward?.name || null,
    reward_snapshot: row.reward || null,
    delivery_id: null,
    status: "blocked",
    error_message: row.errorMessage || "Récompense suspendue lors de la distribution.",
    updated_at: now,
  };
  try {
    await supabaseService.request(TRACKING_TABLE, {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    // Si une ligne existe déjà, on ne la remplace jamais : la contrainte UNIQUE
    // reste la source d'idempotence du classement mensuel.
    const existing = await supabaseService.request(
      `${TRACKING_TABLE}?period=eq.${encodeURIComponent(period)}&position=eq.${row.position}&select=id,status&limit=1`,
      { method: "GET" }
    ).catch(() => []);
    if (!Array.isArray(existing) || !existing.length) throw error;
  }
}

async function patchTracking(id, payload) {
  return supabaseService.request(`${TRACKING_TABLE}?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ ...payload, updated_at: new Date().toISOString() }),
  });
}

function buildMessage(period, row, reward) {
  const parts = [
    `Récompense du classement mensuel ${period} — rang #${row.position}.`,
    `${row.votes} vote${row.votes > 1 ? "s" : ""}.`,
  ];
  if (reward.roubles > 0) parts.push(`${reward.roubles.toLocaleString("fr-FR")} ₽.`);
  if (reward.bitcoinAmount > 0) parts.push(`${reward.bitcoinAmount.toLocaleString("fr-FR")} Bitcoin.`);
  if (reward.battlePassXp > 0) parts.push(`${reward.battlePassXp.toLocaleString("fr-FR")} XP Battle Pass prévus.`);
  return parts.join(" ").slice(0, 500);
}

async function approve(periodInput, actorSteamId) {
  const period = validatePeriod(periodInput);
  const before = await preview(period);
  if (!before.run) {
    const error = new Error("Aucun classement archivé n’existe pour ce mois.");
    error.status = 404;
    throw error;
  }

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of before.rankings) {
    if (row.status === "suspended" && row.steamId) {
      await persistBlockedTracking({ period, run: before.run, row }).catch(() => {});
      skipped += 1;
      continue;
    }
    if (!["ready", "failed"].includes(row.status)) {
      skipped += 1;
      continue;
    }

    const ruleStillExists = row.reward;
    if (!row.steamId || !ruleStillExists) {
      skipped += 1;
      continue;
    }

    const suspension = await voteSuspensionService.getActive(row.steamId).catch(() => null);
    if (suspension?.block_rewards) {
      skipped += 1;
      continue;
    }

    const items = deliveryItemsFromReward(row.reward);
    if (!items.length) {
      skipped += 1;
      continue;
    }

    let reservation;
    try {
      reservation = await reserveTracking({ period, run: before.run, row });
    } catch (error) {
      failed += 1;
      continue;
    }
    if (reservation.skip || !reservation.tracking?.id) {
      skipped += 1;
      continue;
    }

    try {
      const delivery = await deliveryService.createDelivery({
        steamId: row.steamId,
        playerName: row.playerName,
        title: row.reward.name || `Récompense Top ${row.position} — ${period}`,
        message: buildMessage(period, row, row.reward),
        items,
        createdBy: String(actorSteamId || "") || null,
        createdByName: "Classement mensuel Top 10",
      });
      await patchTracking(reservation.tracking.id, {
        status: "delivery_created",
        delivery_id: delivery.id,
        error_message: null,
      });
      created += 1;
    } catch (error) {
      failed += 1;
      await patchTracking(reservation.tracking.id, {
        status: "failed",
        error_message: String(error?.message || error).slice(0, 500),
      }).catch(() => {});
    }
  }

  const after = await preview(period);
  return { ...after, result: { created, skipped, failed } };
}

module.exports = { preview, approve };
