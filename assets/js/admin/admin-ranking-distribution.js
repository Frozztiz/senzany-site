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

// --- Distribution séparée des paliers votes_threshold ---
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

function getThresholdRows(data) {
  if (Array.isArray(data?.players)) return data.players;
  if (Array.isArray(data?.rewards)) return data.rewards;
  if (Array.isArray(data?.entries)) return data.entries;
  if (Array.isArray(data?.rankings)) return data.rankings;
  return [];
}

function renderThresholds(data) {
  thresholdData = data || null;
  const rows = getThresholdRows(data);
  const summary = data?.summary || {};
  const ready = Number(summary.ready || 0);
  const sent = Number(summary.sent || 0);
  if (thresholdEls.players) thresholdEls.players.textContent = formatNumber(summary.players ?? rows.length);
  if (thresholdEls.ready) thresholdEls.ready.textContent = formatNumber(ready);
  if (thresholdEls.sent) thresholdEls.sent.textContent = formatNumber(sent);
  if (thresholdEls.approve) thresholdEls.approve.disabled = !(ready > 0 || Number(summary.failed || 0) > 0);

  if (!thresholdEls.preview) return;
  if (!rows.length) {
    thresholdEls.preview.innerHTML = '<div class="admin-list-message">Aucun palier à distribuer pour ce mois.</div>';
    return;
  }

  thresholdEls.preview.innerHTML = rows.map((row) => {
    const rewards = Array.isArray(row?.rewards) ? row.rewards
      : Array.isArray(row?.thresholds) ? row.thresholds
      : Array.isArray(row?.packs) ? row.packs
      : row?.reward ? [row.reward] : [];
    const names = rewards.map((r) => r?.name || r?.rewardName || r?.label).filter(Boolean);
    const status = String(row?.status || row?.state || "").toLowerCase();
    const label = ({
      ready: "PRÊT", sent: "ENVOYÉ", completed: "ENVOYÉ", processing: "EN COURS",
      failed: "ERREUR — RÉESSAI POSSIBLE", unidentified: "COMPTE À ASSOCIER",
      no_reward: "AUCUN PALIER", no_items: "PACK VIDE", suspended: "RÉCOMPENSE SUSPENDUE",
    })[status] || String(row?.status || row?.state || "").toUpperCase();
    const statusClass = ["sent", "completed"].includes(status) ? "is-sent"
      : status === "ready" ? "is-ready"
      : ["failed", "unidentified", "no_reward", "no_items", "suspended"].includes(status) ? "is-warning" : "";
    const playerName = row?.playerName || row?.name || row?.pseudo || "Pseudo inconnu";
    const steamId = row?.steamId || row?.steamid || row?.steam_id || "Aucun SteamID";
    const votes = row?.votes ?? row?.voteCount ?? row?.totalVotes ?? 0;
    const packText = names.length ? names.join(" + ") : "Paliers atteints";

    return `<article class="ranking-distribution-row ${statusClass}">
      <div class="ranking-distribution-row__rank">✓</div>
      <div class="ranking-distribution-row__player"><strong>${escapeHtml(playerName)}</strong><small>${escapeHtml(steamId)}</small></div>
      <div class="ranking-distribution-row__votes"><strong>${formatNumber(votes)} votes</strong><small>Votes archivés</small></div>
      <div class="ranking-distribution-row__pack"><strong>${escapeHtml(packText)}</strong><small>${rewards.length} palier(s) atteint(s)</small></div>
      <div class="ranking-distribution-row__status"><span>${escapeHtml(label)}</span>${row?.errorMessage ? `<small>${escapeHtml(row.errorMessage)}</small>` : ""}</div>
    </article>`;
  }).join("");
}

async function loadThresholds({ manual = false } = {}) {
  if (!thresholdEls.period || !thresholdEls.load) return;
  if (!thresholdEls.period.value) thresholdEls.period.value = currentMonthPeriod();
  const period = thresholdEls.period.value;
  setLoading(thresholdEls.load, true, "Vérification…");
  setThresholdFeedback(`Chargement des paliers ${period}…`, "loading");
  try {
    const data = await api(`/api/admin/monthly-votes/${encodeURIComponent(period)}/preview${manual ? `?refresh=${Date.now()}` : ""}`);
    renderThresholds(data);
    const summary = data?.summary || {};
    setThresholdFeedback(`${formatPeriodLabel(period)} : ${summary.ready || 0} prêt(s), ${summary.sent || 0} déjà envoyé(s), ${summary.blocked || 0} bloqué(s).`, "success");
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
  if (!period || !thresholdData) return;
  const summary = thresholdData?.summary || {};
  const count = Number(summary.ready || 0) + Number(summary.failed || 0);
  if (!count) return;

  if (!confirm([
    `Créer maintenant les récompenses des PALIERS DE VOTES ${formatPeriodLabel(period)} ?`, "",
    `${count} attribution(s) prête(s) seront traitée(s).`,
    "Seuls les packs « Palier de votes » (votes_threshold) seront utilisés.",
    "Les paliers sont cumulatifs : chaque palier atteint et non encore envoyé sera créé.",
    "Le Top 10 déjà distribué ne sera PAS renvoyé.", "",
    "L’opération est protégée contre les doublons."
  ].join("\n"))) return;

  setLoading(thresholdEls.approve, true, "Création des livraisons…");
  setThresholdFeedback("Création des récompenses de paliers en cours…", "loading");
  try {
    const runId = thresholdData?.run?.id || thresholdData?.runId || thresholdData?.id;
    if (!runId) throw new Error("Identifiant du calcul mensuel introuvable. Vérifie d’abord les paliers.");
    const data = await api(`/api/admin/monthly-votes/${encodeURIComponent(runId)}/approve`, { method: "POST" });
    renderThresholds(data);
    const result = data?.result || {};
    setThresholdFeedback(`${result.created || 0} livraison(s) de palier créée(s), ${result.skipped || 0} ignorée(s), ${result.failed || 0} en échec.`, result.failed ? "error" : "success");
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
