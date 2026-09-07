const byId = (id) => document.getElementById(id);
const els = {
  period: byId("rankingDistributionPeriod"),
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

function previousMonthPeriod() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris", year: "numeric", month: "2-digit"
  }).formatToParts(new Date());
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const previous = new Date(Date.UTC(year, month - 2, 1));
  return `${previous.getUTCFullYear()}-${String(previous.getUTCMonth() + 1).padStart(2, "0")}`;
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

function render(data) {
  currentData = data || null;
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
  if (!els.period.value) els.period.value = previousMonthPeriod();
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

if (els.period && !els.period.value) els.period.value = previousMonthPeriod();
els.load?.addEventListener("click", () => load({ manual: true }));
els.period?.addEventListener("change", () => load({ manual: true }));
els.approve?.addEventListener("click", approve);

// Le mois précédent est chargé automatiquement dès que le module est présent.
if (els.period) load();
