const supabaseService = require("./supabaseService");
const topServeursService = require("./topServeursService");
const voteAliasService = require("./voteAliasService");
const rewardRuleService = require("./rewardRuleService");
const deliveryService = require("./deliveryService");

const RUNS_TABLE = "monthly_vote_runs";
const RANKINGS_TABLE = "monthly_vote_rankings";
const TIME_ZONE = "Europe/Paris";

function periodFromDate(date = new Date(), offsetMonths = 0) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const shifted = new Date(Date.UTC(year, month - 1 + offsetMonths, 1));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}`;
}

function validatePeriod(period) {
  const value = String(period || "").trim();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) {
    const error = new Error("Période invalide. Format attendu : AAAA-MM.");
    error.status = 400;
    throw error;
  }
  return value;
}

function periodParts(period) {
  const [year, month] = validatePeriod(period).split("-").map(Number);
  return { year, month };
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

async function getRunByPeriod(period) {
  const rows = await supabaseService.request(
    `${RUNS_TABLE}?period=eq.${encodeURIComponent(validatePeriod(period))}` +
      "&select=id,period,year,month,status,snapshot_at,approved_at,approved_by,completed_at,error_message,ranking_count,delivery_count,created_at,updated_at&limit=1",
    { method: "GET" }
  );
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function getRunById(id) {
  const rows = await supabaseService.request(
    `${RUNS_TABLE}?id=eq.${encodeURIComponent(id)}` +
      "&select=id,period,year,month,status,snapshot_at,approved_at,approved_by,completed_at,error_message,ranking_count,delivery_count,created_at,updated_at&limit=1",
    { method: "GET" }
  );
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function listRankings(runId) {
  const rows = await supabaseService.request(
    `${RANKINGS_TABLE}?run_id=eq.${encodeURIComponent(runId)}` +
      "&select=id,run_id,position,steam_id,player_name,votes,aliases,reward_rule_id,reward_name,reward_snapshot,delivery_id,status,error_message,created_at,updated_at&order=position.asc",
    { method: "GET" }
  );
  return Array.isArray(rows) ? rows : [];
}

async function buildGroupedRanking() {
  const [ranking, aliases, links] = await Promise.all([
    topServeursService.getPlayersRanking(),
    voteAliasService.listAll(),
    supabaseService.request(
      "user_links?select=steam_id,discord_username&limit=5000",
      { method: "GET" }
    ).catch(() => []),
  ]);

  const linkBySteamId = new Map(
    (Array.isArray(links) ? links : []).map((row) => [String(row.steam_id || ""), row])
  );
  const aliasByNormalized = new Map();
  const groups = new Map();

  for (const alias of aliases) {
    const steamId = String(alias.steamId || "");
    const normalized = voteAliasService.normalizeAlias(alias.alias);
    if (!steamId || !normalized) continue;
    aliasByNormalized.set(normalized, alias);
    if (!groups.has(steamId)) {
      const link = linkBySteamId.get(steamId) || {};
      groups.set(steamId, {
        steamId,
        playerName: link.discord_username || alias.alias || steamId,
        votes: 0,
        aliases: [],
      });
    }
    groups.get(steamId).aliases.push(alias.alias);
  }

  for (const entry of Array.isArray(ranking) ? ranking : []) {
    const alias = aliasByNormalized.get(voteAliasService.normalizeAlias(entry.playerName));
    if (!alias) continue;
    const group = groups.get(String(alias.steamId));
    if (!group) continue;
    group.votes += Number(entry.votes || 0);
  }

  return [...groups.values()]
    .filter((group) => group.votes > 0)
    .sort((a, b) => b.votes - a.votes || a.playerName.localeCompare(b.playerName, "fr"))
    .map((group, index) => ({ ...group, position: index + 1 }));
}

function findRewardRule(rules, position) {
  return (Array.isArray(rules) ? rules : [])
    .filter((rule) =>
      rule.is_active !== false &&
      rule.reward_type === "votes_ranking" &&
      Number(rule.rank_min) <= position &&
      Number(rule.rank_max) >= position
    )
    .sort((a, b) => Number(a.priority || 100) - Number(b.priority || 100))[0] || null;
}

function snapshotReward(rule) {
  if (!rule) return null;
  return {
    id: rule.id,
    name: rule.name,
    description: rule.description || "",
    roubles: Number(rule.roubles || 0),
    battlePassXp: Number(rule.battle_pass_xp || 0),
    items: normalizeItems(rule.items),
    rankMin: Number(rule.rank_min || 1),
    rankMax: Number(rule.rank_max || 1),
    priority: Number(rule.priority || 100),
  };
}

async function createRun(period) {
  const { year, month } = periodParts(period);
  const now = new Date().toISOString();
  const rows = await supabaseService.request(RUNS_TABLE, {
    method: "POST",
    headers: { Prefer: "return=representation,resolution=merge-duplicates" },
    body: JSON.stringify({
      period,
      year,
      month,
      status: "draft",
      snapshot_at: now,
      updated_at: now,
    }),
  });
  return Array.isArray(rows) ? rows[0] : rows;
}

async function prepare(periodInput, { force = false } = {}) {
  const period = validatePeriod(periodInput || periodFromDate());
  let run = await getRunByPeriod(period);

  if (run && ["processing", "completed"].includes(run.status)) {
    const error = new Error("Ce classement a déjà été validé ou est en cours de distribution.");
    error.status = 409;
    throw error;
  }

  if (!run) run = await createRun(period);

  const [groupedRanking, rules] = await Promise.all([
    buildGroupedRanking(),
    rewardRuleService.list(),
  ]);

  const rows = groupedRanking.map((entry) => {
    const rule = findRewardRule(rules, entry.position);
    return {
      run_id: run.id,
      position: entry.position,
      steam_id: entry.steamId,
      player_name: entry.playerName,
      votes: entry.votes,
      aliases: entry.aliases,
      reward_rule_id: rule?.id || null,
      reward_name: rule?.name || null,
      reward_snapshot: snapshotReward(rule),
      status: rule ? "ready" : "no_reward",
      delivery_id: null,
      error_message: null,
      updated_at: new Date().toISOString(),
    };
  });

  await supabaseService.request(`${RANKINGS_TABLE}?run_id=eq.${encodeURIComponent(run.id)}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" },
  });

  if (rows.length) {
    await supabaseService.request(RANKINGS_TABLE, {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(rows),
    });
  }

  const updatedRows = await supabaseService.request(
    `${RUNS_TABLE}?id=eq.${encodeURIComponent(run.id)}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        status: "ready",
        snapshot_at: new Date().toISOString(),
        ranking_count: rows.length,
        delivery_count: 0,
        error_message: null,
        updated_at: new Date().toISOString(),
      }),
    }
  );

  run = Array.isArray(updatedRows) ? updatedRows[0] : updatedRows;
  return { run, rankings: await listRankings(run.id) };
}

function buildDeliveryMessage(row, reward) {
  const parts = [
    reward.description || `Récompense du classement mensuel ${row.position}.`,
    `Classement : #${row.position} — ${row.votes} vote${row.votes > 1 ? "s" : ""}.`,
  ];
  if (reward.roubles > 0) parts.push(`Roubles prévus : ${reward.roubles}.`);
  if (reward.battlePassXp > 0) parts.push(`XP Battle Pass prévue : ${reward.battlePassXp}.`);
  return parts.join(" ").slice(0, 500);
}

async function approve(runId, actorSteamId) {
  const run = await getRunById(runId);
  if (!run) {
    const error = new Error("Classement mensuel introuvable.");
    error.status = 404;
    throw error;
  }
  if (run.status === "completed") {
    const error = new Error("Les livraisons de ce mois ont déjà été créées.");
    error.status = 409;
    throw error;
  }
  if (run.status !== "ready" && run.status !== "failed") {
    const error = new Error("Ce classement n’est pas prêt à être validé.");
    error.status = 409;
    throw error;
  }

  await supabaseService.request(`${RUNS_TABLE}?id=eq.${encodeURIComponent(run.id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      status: "processing",
      approved_at: new Date().toISOString(),
      approved_by: String(actorSteamId || "") || null,
      error_message: null,
      updated_at: new Date().toISOString(),
    }),
  });

  const rankings = await listRankings(run.id);
  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rankings) {
    if (row.delivery_id) {
      skipped += 1;
      continue;
    }
    const reward = row.reward_snapshot;
    const items = normalizeItems(reward?.items);
    if (!reward || !items.length) {
      skipped += 1;
      await supabaseService.request(`${RANKINGS_TABLE}?id=eq.${encodeURIComponent(row.id)}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          status: reward ? "no_items" : "no_reward",
          error_message: reward ? "Le pack ne contient aucun objet DayZ." : null,
          updated_at: new Date().toISOString(),
        }),
      });
      continue;
    }

    try {
      const delivery = await deliveryService.createDelivery({
        steamId: row.steam_id,
        playerName: row.player_name,
        title: reward.name || `Récompense votes ${run.period}`,
        message: buildDeliveryMessage(row, reward),
        items,
        createdBy: String(actorSteamId || "") || null,
        createdByName: "Automatisation votes mensuels",
      });
      created += 1;
      await supabaseService.request(`${RANKINGS_TABLE}?id=eq.${encodeURIComponent(row.id)}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          status: "delivery_created",
          delivery_id: delivery.id,
          error_message: null,
          updated_at: new Date().toISOString(),
        }),
      });
    } catch (error) {
      failed += 1;
      await supabaseService.request(`${RANKINGS_TABLE}?id=eq.${encodeURIComponent(row.id)}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          status: "failed",
          error_message: String(error?.message || error).slice(0, 500),
          updated_at: new Date().toISOString(),
        }),
      });
    }
  }

  const finalStatus = failed > 0 ? "failed" : "completed";
  await supabaseService.request(`${RUNS_TABLE}?id=eq.${encodeURIComponent(run.id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      status: finalStatus,
      completed_at: finalStatus === "completed" ? new Date().toISOString() : null,
      delivery_count: created,
      error_message: failed > 0 ? `${failed} livraison(s) en échec.` : null,
      updated_at: new Date().toISOString(),
    }),
  });

  return {
    run: await getRunById(run.id),
    rankings: await listRankings(run.id),
    summary: { created, skipped, failed },
  };
}

async function status() {
  const currentPeriod = periodFromDate();
  const previousPeriod = periodFromDate(new Date(), -1);
  const rows = await supabaseService.request(
    `${RUNS_TABLE}?select=id,period,year,month,status,snapshot_at,approved_at,approved_by,completed_at,error_message,ranking_count,delivery_count,created_at,updated_at&order=period.desc&limit=12`,
    { method: "GET" }
  );
  return {
    currentPeriod,
    previousPeriod,
    runs: Array.isArray(rows) ? rows : [],
    nextAutomaticSnapshot: "Dernier jour du mois à 23:55 (Europe/Paris)",
    distributionMode: "Validation manuelle le 1er du mois",
  };
}

async function detail(runId) {
  const run = await getRunById(runId);
  if (!run) {
    const error = new Error("Classement mensuel introuvable.");
    error.status = 404;
    throw error;
  }
  return { run, rankings: await listRankings(run.id) };
}

let lastSchedulerKey = null;
function getParisClock(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  return Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
}

function isLastDayOfMonth(year, month, day) {
  return day === new Date(Date.UTC(year, month, 0)).getUTCDate();
}

async function schedulerTick() {
  const clock = getParisClock();
  const key = `${clock.year}-${clock.month}-${clock.day}T${clock.hour}:${clock.minute}`;
  if (key === lastSchedulerKey) return;
  lastSchedulerKey = key;

  const year = Number(clock.year);
  const month = Number(clock.month);
  const day = Number(clock.day);
  const hour = Number(clock.hour);
  const minute = Number(clock.minute);

  try {
    if (isLastDayOfMonth(year, month, day) && hour === 23 && minute === 55) {
      const period = `${year}-${String(month).padStart(2, "0")}`;
      const existing = await getRunByPeriod(period);
      if (!existing || !["ready", "processing", "completed"].includes(existing.status)) {
        await prepare(period, { force: true });
        console.log(`[VOTES MENSUELS] Classement ${period} préparé automatiquement.`);
      }
    }

    if (day === 1 && hour === 0 && minute === 5) {
      const previousPeriod = periodFromDate(new Date(), -1);
      const existing = await getRunByPeriod(previousPeriod);
      if (!existing) {
        await prepare(previousPeriod, { force: true });
        console.warn(`[VOTES MENSUELS] Classement ${previousPeriod} préparé en mode secours le 1er à 00:05.`);
      }
    }
  } catch (error) {
    console.error("[VOTES MENSUELS] Planification impossible :", error?.data || error);
  }
}

function startScheduler() {
  if (String(process.env.MONTHLY_VOTE_SCHEDULER_ENABLED || "true").toLowerCase() === "false") {
    console.log("[VOTES MENSUELS] Planificateur désactivé par configuration.");
    return null;
  }
  schedulerTick();
  const timer = setInterval(schedulerTick, 60_000);
  timer.unref?.();
  console.log("[VOTES MENSUELS] Planificateur actif — Europe/Paris.");
  return timer;
}

module.exports = {
  periodFromDate,
  prepare,
  approve,
  status,
  detail,
  startScheduler,
};
