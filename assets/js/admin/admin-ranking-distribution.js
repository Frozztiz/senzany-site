const byId = (id) => document.getElementById(id);
const els = {
  period: byId("rankingDistributionPeriod"),
  calculate: byId("rankingDistributionCalculate"),
  load: byId("rankingDistributionLoad"),
  approve: byId("rankingDistributionApprove"),
  feedback: byId("rankingDistributionFeedback"),
  preview: byId("rankingDistributionPreview"),
  players: byId("rankingDistributionPlayers"),
  ready: byId("rankingDistributionReady"),
  sent: byId("rankingDistributionSent"),
};

let currentData = null;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("fr-FR");
}

function formatPeriodLabel(period) {
  const match = String(period || "").match(/^(\d{4})-(\d{2})$/);
  if (!match) return period || "Mois inconnu";
  return new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "Europe/Paris" })
    .format(new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1)));
}

function currentMonthPeriod() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris", year: "numeric", month: "2-digit"
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  return `${year}-${month}`;
}

function isCurrentPeriod(period) {
  return String(period || "") === currentMonthPeriod();
}

function setFeedback(message = "", state = "") {
  if (!els.feedback) return;
  els.feedback.hidden = !message;
  els.feedback.textContent = message;
  if (state) els.feedback.dataset.state = state;
  else delete els.feedback.dataset.state;
}

function setLoading(button, loading, label) {
  if (!button) return;
  if (loading) {
    button.dataset.originalText = button.textContent;
    button.disabled = true;
    button.textContent = label;
  } else {
    button.disabled = false;
    button.textContent = button.dataset.originalText || button.textContent;
    delete button.dataset.originalText;
  }
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    method: options.method || "GET",
    credentials: "same-origin",
    cache: "no-store",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || data.message || `Erreur ${response.status}`);
  return data;
}

function stateLabel(row) {
  return ({
    ready: "PRÊT",
    sent: "ENVOYÉ",
    processing: "EN COURS",
    failed: "ERREUR — RÉESSAI POSSIBLE",
    unidentified: "COMPTE À ASSOCIER",
    no_reward: "AUCUN PACK TOP",
    no_items: "PACK VIDE",
    suspended: "RÉCOMPENSE SUSPENDUE",
  })[row?.status] || String(row?.status || "").toUpperCase();
}

function syncCalculateState(data = currentData) {
  if (!els.calculate || !els.period) return;
  const period = els.period.value;
  const sent = Number(data?.summary?.sent || 0);
  const completed = data?.run?.status === "completed";
  els.calculate.disabled = !isCurrentPeriod(period) || sent > 0 || completed;
  els.calculate.title = !isCurrentPeriod(period)
    ? "Le calcul est autorisé uniquement pour le mois en cours."
    : sent > 0
      ? "Le Top 10 a déjà commencé à être distribué : le snapshot est figé."
      : completed
        ? "Les récompenses mensuelles ont déjà été distribuées : le snapshot est figé."
        : "Recalcule le classement du mois en cours à partir des votes Top-Serveurs.";
}

function render(data) {
  currentData = data || null;
  syncCalculateState(currentData);
  const rows = Array.isArray(data?.rankings) ? data.rankings : [];
  const summary = data?.summary || {};
  if (els.players) els.players.textContent = `${rows.length} / 10`;
  if (els.ready) els.ready.textContent = formatNumber(summary.ready || 0);
  if (els.sent) els.sent.textContent = formatNumber(summary.sent || 0);
  if (els.approve) els.approve.disabled = !(Number(summary.ready || 0) > 0 || Number(summary.failed || 0) > 0);

  if (!els.preview) return;
  if (!data?.run) {
    els.preview.innerHTML = '<div class="admin-list-message">Aucun classement archivé trouvé pour ce mois.</div>';
    return;
  }
  if (!rows.length) {
    els.preview.innerHTML = '<div class="admin-list-message">Le snapshot existe, mais aucun joueur n’est classé dans le Top 10.</div>';
    return;
  }

  els.preview.innerHTML = rows.map((row) => {
    const reward = row.reward || null;
    const status = stateLabel(row);
    const statusClass = row.status === "sent" ? "is-sent"
      : row.status === "ready" ? "is-ready"
      : ["failed", "unidentified", "no_reward", "no_items", "suspended"].includes(row.status) ? "is-warning" : "";
    const rewardSummary = reward
      ? [
          Number(reward.roubles || 0) ? `${formatNumber(reward.roubles)} ₽` : "",
          Number(reward.bitcoinAmount || 0) ? `${formatNumber(reward.bitcoinAmount)} BTC` : "",
          Array.isArray(reward.items) && reward.items.length ? `${reward.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0)} objet(s)` : "",
        ].filter(Boolean).join(" • ")
      : "Aucune récompense";

    return `<article class="ranking-distribution-row ${statusClass}">
      <div class="ranking-distribution-row__rank">#${Number(row.position || 0)}</div>
      <div class="ranking-distribution-row__player"><strong>${escapeHtml(row.playerName || "Pseudo inconnu")}</strong><small>${escapeHtml(row.steamId || "Aucun SteamID")}</small></div>
      <div class="ranking-distribution-row__votes"><strong>${formatNumber(row.votes)} votes</strong><small>Classement archivé</small></div>
      <div class="ranking-distribution-row__pack"><strong>${escapeHtml(reward?.name || "Aucun pack Top")}</strong><small>${escapeHtml(rewardSummary)}</small></div>
      <div class="ranking-distribution-row__status"><span>${escapeHtml(status)}</span>${row.errorMessage ? `<small>${escapeHtml(row.errorMessage)}</small>` : ""}</div>
    </article>`;
  }).join("");
}

async function load({ manual = false } = {}) {
  if (!els.period || !els.load) return;
  if (!els.period.value) els.period.value = currentMonthPeriod();
  const period = els.period.value;
  setLoading(els.load, true, "Vérification…");
  setFeedback(`Chargement du Top 10 ${period}…`, "loading");
  try {
    const data = await api(`/api/admin/monthly-votes/ranking-rewards/${encodeURIComponent(period)}/preview${manual ? `?refresh=${Date.now()}` : ""}`);
    render(data);
    const summary = data.summary || {};
    setFeedback(`${formatPeriodLabel(period)} : ${summary.ready || 0} prêt(s), ${summary.sent || 0} déjà envoyé(s), ${summary.blocked || 0} bloqué(s).`, "success");
  } catch (error) {
    currentData = null;
    if (els.approve) els.approve.disabled = true;
    if (els.preview) els.preview.innerHTML = `<div class="admin-list-message admin-list-message--error">${escapeHtml(error.message)}</div>`;
    setFeedback(error.message, "error");
  } finally {
    setLoading(els.load, false);
  }
}

async function calculate() {
  if (!els.period || !els.calculate) return;
  const period = els.period.value || currentMonthPeriod();
  els.period.value = period;

  if (!isCurrentPeriod(period)) {
    setFeedback("Le calcul est autorisé uniquement pour le mois en cours. Les anciens mois restent consultables mais ne sont jamais recalculés.", "error");
    syncCalculateState();
    return;
  }

  if (Number(currentData?.summary?.sent || 0) > 0 || currentData?.run?.status === "completed") {
    setFeedback("Ce classement a déjà été distribué : le snapshot est figé et ne peut plus être recalculé.", "error");
    syncCalculateState();
    return;
  }

  if (!confirm([
    `Calculer ou mettre à jour le classement de ${formatPeriodLabel(period)} ?`,
    "",
    "Le snapshot sera remplacé par les votes actuellement disponibles sur Top-Serveurs.",
    "Aucune récompense ne sera distribuée pendant ce calcul.",
    "Les paliers de votes et le Top 10 resteront deux systèmes de récompenses séparés."
  ].join("\n"))) return;

  setLoading(els.calculate, true, "CALCUL EN COURS…");
  setFeedback("Synchronisation des votes Top-Serveurs et mise à jour du snapshot mensuel…", "loading");
  try {
    await api("/api/admin/monthly-votes/prepare", {
      method: "POST",
      body: { period, force: true },
    });
    const data = await api(`/api/admin/monthly-votes/ranking-rewards/${encodeURIComponent(period)}/preview?refresh=${Date.now()}`);
    render(data);
    const summary = data.summary || {};
    setFeedback(
      `${formatPeriodLabel(period)} recalculé : ${(data.rankings || []).length} joueur(s) dans le Top 10, ${summary.ready || 0} prêt(s), ${summary.blocked || 0} bloqué(s). Aucune récompense n’a encore été envoyée.`,
      "success"
    );
  } catch (error) {
    setFeedback(error.message, "error");
  } finally {
    setLoading(els.calculate, false);
    syncCalculateState();
  }
}

async function approve() {
  const period = els.period?.value;
  if (!period || !currentData) return;
  const summary = currentData.summary || {};
  const count = Number(summary.ready || 0) + Number(summary.failed || 0);
  if (!count) return;

  if (!confirm([
    `Créer maintenant les récompenses du CLASSEMENT MENSUEL ${formatPeriodLabel(period)} ?`,
    "",
    `${count} joueur(s) seront traité(s).`,
    "Seuls les packs « Classement mensuel » (votes_ranking) seront utilisés.",
    "Les paliers de votes déjà distribués ne seront PAS renvoyés.",
    "",
    "L’opération est protégée contre les doublons."
  ].join("\n"))) return;

  setLoading(els.approve, true, "Création des livraisons…");
  setFeedback("Création des récompenses Top 10 en cours…", "loading");
  try {
    const data = await api(`/api/admin/monthly-votes/ranking-rewards/${encodeURIComponent(period)}/approve`, { method: "POST" });
    render(data);
    const result = data.result || {};
    setFeedback(`${result.created || 0} livraison(s) Top 10 créée(s), ${result.skipped || 0} ignorée(s), ${result.failed || 0} en échec.`, result.failed ? "error" : "success");
  } catch (error) {
    setFeedback(error.message, "error");
  } finally {
    setLoading(els.approve, false);
  }
}

if (els.period && !els.period.value) els.period.value = currentMonthPeriod();
if (els.period) els.period.max = currentMonthPeriod();
els.calculate?.addEventListener("click", calculate);
els.load?.addEventListener("click", () => load({ manual: true }));
els.period?.addEventListener("change", () => {
  syncCalculateState(null);
  load({ manual: true });
});
els.approve?.addEventListener("click", approve);

// Le mois courant est chargé automatiquement. Les anciens mois restent consultables sans recalcul.
if (els.period) load();

// -----------------------------------------------------------------------------
// Distribution séparée des paliers mensuels (votes_threshold)
// Utilise le flux historique réel : /status -> /:runId -> /:runId/approve.
// Si aucun snapshot n'existe encore pour le mois courant, /prepare peut le créer.
// -----------------------------------------------------------------------------
const thresholdEls = {
  period: byId("thresholdDistributionPeriod"),
  load: byId("thresholdDistributionLoad"),
  approve: byId("thresholdDistributionApprove"),
  feedback: byId("thresholdDistributionFeedback"),
  preview: byId("thresholdDistributionPreview"),
  players: byId("thresholdDistributionPlayers"),
  ready: byId("thresholdDistributionReady"),
  sent: byId("thresholdDistributionSent"),
};

let thresholdData = null;

function setThresholdFeedback(message = "", state = "") {
  if (!thresholdEls.feedback) return;
  thresholdEls.feedback.hidden = !message;
  thresholdEls.feedback.textContent = message;
  if (state) thresholdEls.feedback.dataset.state = state;
  else delete thresholdEls.feedback.dataset.state;
}

function thresholdStatusLabel(status) {
  return ({
    ready: "PRÊT",
    delivery_created: "ENVOYÉ",
    failed: "ERREUR — RÉESSAI POSSIBLE",
    unidentified: "COMPTE À ASSOCIER",
    no_reward: "AUCUN PALIER",
    no_items: "PACK VIDE",
  })[status] || String(status || "").toUpperCase();
}

function thresholdSummary(data) {
  const rows = Array.isArray(data?.rankings) ? data.rankings : [];
  return {
    players: rows.length,
    ready: rows.filter((row) => row.status === "ready" || row.status === "failed").length,
    sent: rows.filter((row) => row.status === "delivery_created" || Boolean(row.delivery_id)).length,
    blocked: rows.filter((row) => ["unidentified", "no_items"].includes(row.status)).length,
  };
}

function renderThresholds(data) {
  thresholdData = data || null;
  const rows = Array.isArray(data?.rankings) ? data.rankings : [];
  const summary = thresholdSummary(data);

  if (thresholdEls.players) thresholdEls.players.textContent = formatNumber(summary.players);
  if (thresholdEls.ready) thresholdEls.ready.textContent = formatNumber(summary.ready);
  if (thresholdEls.sent) thresholdEls.sent.textContent = formatNumber(summary.sent);

  const runStatus = data?.run?.status || "";
  if (thresholdEls.approve) {
    thresholdEls.approve.disabled = !(summary.ready > 0 && ["ready", "failed"].includes(runStatus));
  }

  if (!thresholdEls.preview) return;
  if (!data?.run) {
    thresholdEls.preview.innerHTML = '<div class="admin-list-message">Aucun snapshot mensuel trouvé.</div>';
    return;
  }
  if (!rows.length) {
    thresholdEls.preview.innerHTML = '<div class="admin-list-message">Le snapshot existe mais ne contient aucun joueur.</div>';
    return;
  }

  thresholdEls.preview.innerHTML = rows.map((row) => {
    const reward = row.reward_snapshot || null;
    const reachedRules = Array.isArray(reward?.reachedRules) ? reward.reachedRules : [];
    const reachedText = reachedRules.length
      ? reachedRules.map((rule) => `${formatNumber(rule.thresholdValue)} votes — ${rule.name || "Palier"}`).join(" • ")
      : "Aucun palier atteint";

    const status = String(row.status || "");
    const statusClass = status === "delivery_created" || row.delivery_id ? "is-sent"
      : status === "ready" ? "is-ready"
      : ["failed", "unidentified", "no_items"].includes(status) ? "is-warning" : "";

    const rewardParts = reward ? [
      Number(reward.roubles || 0) ? `${formatNumber(reward.roubles)} ₽` : "",
      Number(reward.bitcoinAmount || 0) ? `${formatNumber(reward.bitcoinAmount)} BTC` : "",
      Array.isArray(reward.items) && reward.items.length
        ? `${reward.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0)} objet(s)`
        : "",
    ].filter(Boolean).join(" • ") : "";

    return `<article class="ranking-distribution-row ${statusClass}">
      <div class="ranking-distribution-row__rank">#${Number(row.position || 0)}</div>
      <div class="ranking-distribution-row__player">
        <strong>${escapeHtml(row.player_name || "Pseudo inconnu")}</strong>
        <small>${escapeHtml(row.steam_id || "Aucun SteamID")}</small>
      </div>
      <div class="ranking-distribution-row__votes">
        <strong>${formatNumber(row.votes)} votes</strong>
        <small>${escapeHtml(reachedText)}</small>
      </div>
      <div class="ranking-distribution-row__pack">
        <strong>${escapeHtml(reward?.name || "Aucun palier")}</strong>
        <small>${escapeHtml(rewardParts || "Aucune récompense")}</small>
      </div>
      <div class="ranking-distribution-row__status">
        <span>${escapeHtml(thresholdStatusLabel(row.delivery_id ? "delivery_created" : status))}</span>
        ${row.error_message ? `<small>${escapeHtml(row.error_message)}</small>` : ""}
      </div>
    </article>`;
  }).join("");
}

async function getThresholdRunForPeriod(period) {
  const statusData = await api("/api/admin/monthly-votes/status");
  const runs = Array.isArray(statusData?.runs) ? statusData.runs : [];
  return runs.find((run) => String(run.period) === String(period)) || null;
}

async function loadThresholds({ manual = false } = {}) {
  if (!thresholdEls.period || !thresholdEls.load) return;
  if (!thresholdEls.period.value) thresholdEls.period.value = currentMonthPeriod();
  const period = thresholdEls.period.value;

  setLoading(thresholdEls.load, true, "Vérification…");
  setThresholdFeedback(`Chargement des paliers ${period}…`, "loading");

  try {
    let run = await getThresholdRunForPeriod(period);

    if (!run && isCurrentPeriod(period)) {
      const prepared = await api("/api/admin/monthly-votes/prepare", {
        method: "POST",
        body: { period, force: false },
      });
      run = prepared?.run || null;
      if (run?.id) {
        const data = await api(`/api/admin/monthly-votes/${encodeURIComponent(run.id)}${manual ? `?refresh=${Date.now()}` : ""}`);
        renderThresholds(data);
        const summary = thresholdSummary(data);
        setThresholdFeedback(`${formatPeriodLabel(period)} préparé : ${summary.ready} prêt(s), ${summary.sent} déjà envoyé(s), ${summary.blocked} bloqué(s).`, "success");
        return;
      }
    }

    if (!run?.id) {
      thresholdData = null;
      renderThresholds(null);
      setThresholdFeedback(`Aucun snapshot de paliers trouvé pour ${formatPeriodLabel(period)}.`, "error");
      return;
    }

    const data = await api(`/api/admin/monthly-votes/${encodeURIComponent(run.id)}${manual ? `?refresh=${Date.now()}` : ""}`);
    renderThresholds(data);
    const summary = thresholdSummary(data);
    setThresholdFeedback(`${formatPeriodLabel(period)} : ${summary.ready} prêt(s), ${summary.sent} déjà envoyé(s), ${summary.blocked} bloqué(s).`, "success");
  } catch (error) {
    thresholdData = null;
    if (thresholdEls.approve) thresholdEls.approve.disabled = true;
    if (thresholdEls.preview) thresholdEls.preview.innerHTML = `<div class="admin-list-message admin-list-message--error">${escapeHtml(error.message)}</div>`;
    setThresholdFeedback(error.message, "error");
  } finally {
    setLoading(thresholdEls.load, false);
  }
}

async function approveThresholds() {
  const period = thresholdEls.period?.value;
  const runId = thresholdData?.run?.id;
  if (!period || !runId) return;

  const summary = thresholdSummary(thresholdData);
  if (!summary.ready) return;

  if (!confirm([
    `Créer maintenant les récompenses des PALIERS DE VOTES ${formatPeriodLabel(period)} ?`,
    "",
    `${summary.ready} joueur(s) prêt(s) seront traité(s).`,
    "Les récompenses sont cumulées jusqu’au plus haut palier atteint.",
    "Le Top 10 déjà distribué ne sera PAS renvoyé.",
    "Les lignes possédant déjà une livraison sont ignorées.",
  ].join("\n"))) return;

  setLoading(thresholdEls.approve, true, "Création des livraisons…");
  setThresholdFeedback("Création des récompenses de paliers en cours…", "loading");

  try {
    const result = await api(`/api/admin/monthly-votes/${encodeURIComponent(runId)}/approve`, { method: "POST" });
    renderThresholds(result);
    const summaryResult = result?.summary || {};
    setThresholdFeedback(
      `${summaryResult.created || 0} livraison(s) créée(s), ${summaryResult.skipped || 0} ignorée(s), ${summaryResult.failed || 0} en échec.`,
      Number(summaryResult.failed || 0) > 0 ? "error" : "success"
    );
  } catch (error) {
    setThresholdFeedback(error.message, "error");
  } finally {
    setLoading(thresholdEls.approve, false);
  }
}

if (thresholdEls.period && !thresholdEls.period.value) thresholdEls.period.value = currentMonthPeriod();
if (thresholdEls.period) thresholdEls.period.max = currentMonthPeriod();
thresholdEls.load?.addEventListener("click", () => loadThresholds({ manual: true }));
thresholdEls.period?.addEventListener("change", () => loadThresholds({ manual: true }));
thresholdEls.approve?.addEventListener("click", approveThresholds);
if (thresholdEls.period) loadThresholds();
