import { addItemRow, clearItemRows, getItemsFromContainer, escapeHtml } from "./items.js";

const byId = (id) => document.getElementById(id);
let rules = [];
let saving = false;

const els = {
  loading: byId("rewardsAccessLoading"), denied: byId("rewardsAccessDenied"), error: byId("rewardsAccessError"), workspace: byId("rewardsWorkspace"),
  form: byId("rewardForm"), id: byId("rewardId"), type: byId("rewardType"), typeField: byId("rewardTypeField"), name: byId("rewardName"),
  modeTabs: Array.from(document.querySelectorAll("[data-reward-mode]")),
  rankingFields: byId("rewardRankingFields"), thresholdFields: byId("rewardThresholdFields"),
  rankMin: byId("rewardRankMin"), rankMax: byId("rewardRankMax"), thresholdValue: byId("rewardThresholdValue"),
  roubles: byId("rewardRoubles"), bitcoin: byId("rewardBitcoin"), xp: byId("rewardBattlePassXp"), description: byId("rewardDescription"), active: byId("rewardActive"), priority: byId("rewardPriority"),
  items: byId("rewardItemsList"), addItem: byId("addRewardItem"), save: byId("saveRewardRule"), cancel: byId("cancelRewardEdit"), formFeedback: byId("rewardFormFeedback"),
  list: byId("rewardsList"), feedback: byId("rewardsFeedback"), search: byId("rewardsSearch"), filter: byId("rewardsTypeFilter"), refresh: byId("refreshRewards"), newRule: byId("newRewardRule"),
  rankingsCount: byId("rewardsRankings"), thresholdsCount: byId("rewardsThresholds"), battlePassCount: byId("rewardsBattlePass"), eventsCount: byId("rewardsEvents"),
  previewName: byId("rewardPreviewName"), previewType: byId("rewardPreviewType"), previewApplication: byId("rewardPreviewApplication"),
  previewRoubles: byId("rewardPreviewRoubles"), previewBitcoin: byId("rewardPreviewBitcoin"), previewXp: byId("rewardPreviewXp"), previewItems: byId("rewardPreviewItems"),
};

const monthlyEls = {
  period: byId("monthlyRewardPeriod"),
  status: byId("monthlyRewardStatus"),
  schedule: byId("monthlyRewardSchedule"),
  players: byId("monthlyRewardPlayers"),
  deliveries: byId("monthlyRewardDeliveries"),
  deliveryNote: byId("monthlyRewardDeliveryNote"),
  prepare: byId("prepareMonthlyRanking"),
  approve: byId("approveMonthlyRewards"),
  refresh: byId("refreshMonthlyRewards"),
  feedback: byId("monthlyRewardFeedback"),
  preview: byId("monthlyRewardPreview"),
};
let monthlyRun = null;
let monthlyRankings = [];

function showOnly(target) {
  [els.loading, els.denied, els.error, els.workspace].forEach((node) => { if (node) node.hidden = node !== target; });
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    method: options.method || "GET", credentials: "same-origin", cache: "no-store",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || data.message || `Erreur ${response.status}`);
  return data;
}

function typeLabel(type) {
  return ({
    votes_ranking: "Classement mensuel",
    votes_threshold: "Palier de votes",
    event: "Événement",
    fidelity: "Fidélité",
    battle_pass: "Battle Pass",
    compensation: "Compensation",
  })[type] || type;
}

function isRankingType(type) { return type === "votes_ranking"; }
function isThresholdType(type) { return type === "votes_threshold"; }

function applicationLabel(rule) {
  if (isThresholdType(rule.reward_type)) return `Palier ${formatNumber(rule.threshold_value)} votes`;
  if (isRankingType(rule.reward_type)) {
    const min = Number(rule.rank_min); const max = Number(rule.rank_max);
    return min === max ? `Top ${min}` : `Top ${min} à ${max}`;
  }
  return "Application manuelle";
}

function formatNumber(value) { return Number(value || 0).toLocaleString("fr-FR"); }
function normalizeItems(items) {
  if (!Array.isArray(items)) return [];
  return items.map((item) => ({ className: item.className || item.classname || item.name || "", quantity: Number(item.quantity || item.qty || 1) })).filter((item) => item.className);
}
function setFeedback(node, message = "", state = "") {
  if (!node) return;
  node.hidden = !message;
  node.textContent = message;
  if (state) node.dataset.state = state; else delete node.dataset.state;
}
function setLoading(button, isLoading, label) {
  if (!button) return;
  if (isLoading) { button.dataset.originalText = button.textContent; button.disabled = true; button.textContent = label; }
  else { button.disabled = false; button.textContent = button.dataset.originalText || button.textContent; delete button.dataset.originalText; }
}

function currentMode() {
  if (isRankingType(els.type.value)) return "votes_ranking";
  if (isThresholdType(els.type.value)) return "votes_threshold";
  return "other";
}

function syncModeTabs() {
  const mode = currentMode();
  els.modeTabs.forEach((button) => {
    const active = button.dataset.rewardMode === mode;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", String(active));
  });
  els.typeField.hidden = mode !== "other";
  document.querySelector(".reward-name-field")?.classList.toggle("reward-name-field--wide", mode !== "other");
}

function selectMode(mode) {
  if (mode === "votes_ranking" || mode === "votes_threshold") {
    els.type.value = mode;
  } else if (isRankingType(els.type.value) || isThresholdType(els.type.value)) {
    els.type.value = "event";
  }
  updateApplicationFields();
  updatePreview();
}

function updateApplicationFields() {
  const ranking = isRankingType(els.type.value);
  const threshold = isThresholdType(els.type.value);
  els.rankingFields.hidden = !ranking;
  els.thresholdFields.hidden = !threshold;
  els.rankMin.required = ranking;
  els.rankMax.required = ranking;
  els.thresholdValue.required = threshold;
  syncModeTabs();
}

function filteredRules() {
  const query = String(els.search.value || "").trim().toLowerCase();
  const type = els.filter.value;
  return rules.filter((rule) => {
    if (type && rule.reward_type !== type) return false;
    if (!query) return true;
    const itemText = normalizeItems(rule.items).map((item) => item.className).join(" ");
    return [rule.name, rule.description, typeLabel(rule.reward_type), applicationLabel(rule), itemText].join(" ").toLowerCase().includes(query);
  });
}

function compactRewardSummary(rule) {
  const parts = [];
  const roubles = Number(rule.roubles || 0);
  const bitcoin = Number(rule.bitcoin_amount || 0);
  const xp = Number(rule.battle_pass_xp || 0);
  const itemCount = normalizeItems(rule.items).reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  if (roubles) parts.push(`${formatNumber(roubles)} ₽`);
  if (bitcoin) parts.push(`${formatNumber(bitcoin)} BTC`);
  if (xp) parts.push(`${formatNumber(xp)} XP`);
  if (itemCount) parts.push(`${formatNumber(itemCount)} objet${itemCount > 1 ? "s" : ""}`);
  return parts.length ? parts.join(" • ") : "Aucune récompense configurée";
}

function renderRule(rule) {
  const article = document.createElement("article");
  article.className = `reward-rule reward-rule--compact ${rule.is_active ? "is-active" : "is-inactive"}`;
  article.dataset.openReward = rule.id;
  article.tabIndex = 0;
  article.setAttribute("role", "button");
  article.setAttribute("aria-label", `Modifier le pack ${rule.name}`);
  article.innerHTML = `
    <div class="reward-rule__status" aria-hidden="true"></div>
    <div class="reward-rule__identity">
      <span>${escapeHtml(typeLabel(rule.reward_type))}</span>
      <strong>${escapeHtml(rule.name)}</strong>
      <small>${escapeHtml(applicationLabel(rule))}</small>
    </div>
    <div class="reward-rule__summary">${escapeHtml(compactRewardSummary(rule))}</div>
    <div class="reward-rule__state"><em>${rule.is_active ? "ACTIF" : "INACTIF"}</em></div>
    <div class="reward-rule__menu">
      <button type="button" class="reward-rule__icon" data-duplicate-reward="${escapeHtml(rule.id)}" title="Dupliquer">⧉</button>
      <button type="button" class="reward-rule__icon reward-rule__icon--danger" data-delete-reward="${escapeHtml(rule.id)}" title="Supprimer">×</button>
    </div>`;
  return article;
}

function render() {
  const filtered = filteredRules();
  const packLabel = (count) => `${count} pack${count > 1 ? "s" : ""}`;
  els.rankingsCount.textContent = packLabel(rules.filter((rule) => rule.reward_type === "votes_ranking").length);
  els.thresholdsCount.textContent = packLabel(rules.filter((rule) => rule.reward_type === "votes_threshold").length);
  els.battlePassCount.textContent = packLabel(rules.filter((rule) => rule.reward_type === "battle_pass").length);
  els.eventsCount.textContent = packLabel(rules.filter((rule) => rule.reward_type === "event").length);
  els.list.innerHTML = "";
  if (!filtered.length) {
    els.list.innerHTML = '<div class="admin-list-message">Aucun pack ne correspond aux filtres.</div>';
    return;
  }
  filtered.forEach((rule) => els.list.appendChild(renderRule(rule)));
}

function updatePreview() {
  const items = getItemsFromContainer(els.items).map((item) => ({ className: item.className || item.name || "", quantity: Number(item.quantity || 1) })).filter((item) => item.className);
  const previewRule = {
    reward_type: els.type.value,
    rank_min: Math.max(1, Number(els.rankMin.value || 1)),
    rank_max: Math.max(1, Number(els.rankMax.value || els.rankMin.value || 1)),
    threshold_value: Math.max(1, Number(els.thresholdValue.value || 1)),
  };
  els.previewName.textContent = els.name.value.trim() || "Pack sans nom";
  els.previewType.textContent = typeLabel(els.type.value);
  els.previewApplication.textContent = applicationLabel(previewRule);
  els.previewRoubles.textContent = `${formatNumber(els.roubles.value)} ₽`;
  els.previewBitcoin.textContent = formatNumber(els.bitcoin.value);
  els.previewXp.textContent = formatNumber(els.xp.value);
  els.previewItems.innerHTML = items.length
    ? items.map((item) => `<small>${escapeHtml(item.className)} × ${item.quantity}</small>`).join("")
    : "Aucun objet configuré";
}

function resetForm(rule = null) {
  els.id.value = rule?.id || "";
  els.type.value = rule?.reward_type || "votes_ranking";
  els.name.value = rule?.name || "";
  els.rankMin.value = rule?.rank_min || 1;
  els.rankMax.value = rule?.rank_max || 1;
  els.thresholdValue.value = rule?.threshold_value || 200;
  els.roubles.value = rule?.roubles || 0;
  els.bitcoin.value = rule?.bitcoin_amount || 0;
  els.xp.value = rule?.battle_pass_xp || 0;
  els.description.value = rule?.description || "";
  els.active.checked = rule?.is_active ?? true;
  els.priority.value = rule?.priority ?? 100;
  els.items.innerHTML = "";
  const items = normalizeItems(rule?.items);
  if (items.length) items.forEach((item) => addItemRow(els.items, item)); else clearItemRows(els.items);
  byId("rewardFormKicker").textContent = rule ? "MODIFICATION DU PACK" : "NOUVEAU PACK";
  byId("rewardFormTitle").textContent = rule ? "Modifier le pack" : "Créer un pack";
  els.save.textContent = rule ? "ENREGISTRER LES MODIFICATIONS" : "ENREGISTRER LE PACK";
  els.cancel.hidden = !rule;
  setFeedback(els.formFeedback);
  updateApplicationFields();
  updatePreview();
}

async function loadRules() {
  setLoading(els.refresh, true, "Chargement…");
  setFeedback(els.feedback, "Chargement des packs…", "loading");
  try {
    const data = await api("/api/admin/rewards");
    rules = Array.isArray(data.rules) ? data.rules : [];
    setFeedback(els.feedback);
    render();
  } catch (error) {
    setFeedback(els.feedback, error.message, "error");
  } finally { setLoading(els.refresh, false); }
}

async function saveRule(event) {
  event.preventDefault();
  if (saving) return;
  const rewardType = els.type.value;
  const rankMin = Number(els.rankMin.value || 1);
  const rankMax = Number(els.rankMax.value || rankMin);
  const thresholdValue = Number(els.thresholdValue.value || 0);
  if (!els.name.value.trim()) { setFeedback(els.formFeedback, "Le nom du pack est obligatoire.", "error"); return; }
  if (isRankingType(rewardType) && rankMax < rankMin) { setFeedback(els.formFeedback, "Le Top maximum ne peut pas être inférieur au Top minimum.", "error"); return; }
  if (isThresholdType(rewardType) && thresholdValue < 1) { setFeedback(els.formFeedback, "Le palier doit être supérieur à zéro.", "error"); return; }
  const roubles = Number(els.roubles.value || 0);
  if (roubles > 0 && roubles % 50000 !== 0) {
    setFeedback(els.formFeedback, "Le montant en roubles doit être un multiple de 50 000 ₽ pour créer automatiquement les lots de billets.", "error");
    return;
  }
  saving = true; setLoading(els.save, true, "Enregistrement…");
  const id = els.id.value;
  const payload = {
    rewardType, name: els.name.value.trim(),
    rankMin: isRankingType(rewardType) ? rankMin : 1,
    rankMax: isRankingType(rewardType) ? rankMax : 1,
    thresholdValue: isThresholdType(rewardType) ? thresholdValue : null,
    roubles, bitcoinAmount: Number(els.bitcoin.value || 0), battlePassXp: Number(els.xp.value || 0),
    description: els.description.value.trim(), isActive: els.active.checked,
    priority: Number(els.priority.value || 100),
    items: getItemsFromContainer(els.items).map((item) => ({ classname: item.className || item.name, quantity: item.quantity })),
  };
  try {
    await api(id ? `/api/admin/rewards/${encodeURIComponent(id)}` : "/api/admin/rewards", { method: id ? "PUT" : "POST", body: payload });
    resetForm();
    setFeedback(els.formFeedback, id ? "Le pack a été modifié." : "Le pack a été créé.", "success");
    await loadRules();
  } catch (error) { setFeedback(els.formFeedback, error.message, "error"); }
  finally { saving = false; setLoading(els.save, false); }
}

function duplicateRule(id) {
  const rule = rules.find((entry) => entry.id === id);
  if (!rule) return;
  const copy = {
    ...rule,
    id: "",
    name: `Copie de ${rule.name}`.slice(0, 100),
    is_active: false,
  };
  resetForm(copy);
  byId("rewardFormKicker").textContent = "DUPLICATION DU PACK";
  byId("rewardFormTitle").textContent = "Créer depuis une copie";
  els.save.textContent = "ENREGISTRER LA COPIE";
  els.cancel.hidden = false;
  setFeedback(els.formFeedback, "Le pack a été copié dans le formulaire. Vérifie les valeurs puis enregistre-le.", "success");
  document.querySelector(".rewards-editor-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
  els.name.focus();
  els.name.select();
}

async function deleteRule(id) {
  const rule = rules.find((entry) => entry.id === id);
  if (!rule || !confirm(`Supprimer le pack « ${rule.name} » ?`)) return;
  try { await api(`/api/admin/rewards/${encodeURIComponent(id)}`, { method: "DELETE" }); await loadRules(); }
  catch (error) { alert(error.message); }
}


function monthlyStatusLabel(status) {
  return ({
    draft: "Brouillon",
    ready: "Prêt à valider",
    processing: "Distribution en cours",
    completed: "Livraisons créées",
    failed: "Erreur de distribution",
  })[status] || "Aucun classement";
}

function monthlyRowState(row) {
  return ({
    ready: "PRÊT",
    no_reward: "AUCUN PACK",
    no_items: "PACK SANS OBJET",
    delivery_created: "LIVRAISON CRÉÉE",
    failed: "ERREUR",
    pending: "EN ATTENTE",
  })[row.status] || String(row.status || "").toUpperCase();
}

function renderMonthlyPreview() {
  if (!monthlyEls.preview) return;
  if (!monthlyRun || !monthlyRankings.length) {
    monthlyEls.preview.innerHTML = '<div class="admin-list-message">Aucun classement mensuel préparé.</div>';
    return;
  }

  monthlyEls.preview.innerHTML = monthlyRankings.map((row) => {
    const rewardName = row.reward_name || "Aucun pack configuré";
    const aliases = Array.isArray(row.aliases) ? row.aliases.join(", ") : "";
    const stateClass = ["no_reward", "no_items"].includes(row.status) ? "is-warning" : row.status === "failed" ? "is-error" : "";
    return `<article class="monthly-ranking-row">
      <strong>#${Number(row.position || 0)}</strong>
      <div class="monthly-ranking-row__player"><b>${escapeHtml(row.player_name || row.steam_id)}</b><small>${escapeHtml(aliases || row.steam_id)}</small></div>
      <div class="monthly-ranking-row__votes">${formatNumber(row.votes)} votes</div>
      <div class="monthly-ranking-row__reward">${escapeHtml(rewardName)}</div>
      <div class="monthly-ranking-row__state ${stateClass}">${escapeHtml(monthlyRowState(row))}</div>
    </article>`;
  }).join("");
}

function renderMonthlyState() {
  if (!monthlyEls.status) return;
  monthlyEls.status.textContent = monthlyStatusLabel(monthlyRun?.status);
  monthlyEls.players.textContent = formatNumber(monthlyRun?.ranking_count || monthlyRankings.length || 0);
  monthlyEls.deliveries.textContent = formatNumber(monthlyRun?.delivery_count || 0);
  monthlyEls.deliveryNote.textContent = monthlyRun?.status === "completed"
    ? "Distribution terminée"
    : monthlyRun?.status === "failed"
      ? (monthlyRun.error_message || "Certaines livraisons ont échoué")
      : "Aucune distribution lancée";
  monthlyEls.approve.disabled = !monthlyRun || !["ready", "failed"].includes(monthlyRun.status);
  renderMonthlyPreview();
}

async function loadMonthlyRun(runId) {
  if (!runId) {
    monthlyRun = null;
    monthlyRankings = [];
    renderMonthlyState();
    return;
  }
  const detail = await api(`/api/admin/monthly-votes/${encodeURIComponent(runId)}`);
  monthlyRun = detail.run || null;
  monthlyRankings = Array.isArray(detail.rankings) ? detail.rankings : [];
  renderMonthlyState();
}

async function loadMonthlyStatus() {
  if (!monthlyEls.refresh) return;
  setLoading(monthlyEls.refresh, true, "Chargement…");
  setFeedback(monthlyEls.feedback, "Chargement de l’automatisation mensuelle…", "loading");
  try {
    const data = await api("/api/admin/monthly-votes/status");
    monthlyEls.schedule.textContent = `${data.nextAutomaticSnapshot} — ${data.distributionMode}`;
    if (!monthlyEls.period.value) monthlyEls.period.value = data.currentPeriod;
    const selectedPeriod = monthlyEls.period.value;
    const run = (Array.isArray(data.runs) ? data.runs : []).find((entry) => entry.period === selectedPeriod)
      || (Array.isArray(data.runs) ? data.runs[0] : null);
    if (run?.period && run.period !== selectedPeriod) monthlyEls.period.value = run.period;
    setFeedback(monthlyEls.feedback);
    await loadMonthlyRun(run?.id);
  } catch (error) {
    setFeedback(monthlyEls.feedback, error.message, "error");
  } finally {
    setLoading(monthlyEls.refresh, false);
  }
}

async function prepareMonthlyRanking() {
  const period = monthlyEls.period.value;
  if (!period) {
    setFeedback(monthlyEls.feedback, "Choisis le mois à préparer.", "error");
    return;
  }
  if (!confirm(`Préparer ou recalculer le classement ${period} à partir des votes actuellement disponibles ?`)) return;
  setLoading(monthlyEls.prepare, true, "Calcul en cours…");
  setFeedback(monthlyEls.feedback, "Synchronisation Top-Serveurs et regroupement par SteamID…", "loading");
  try {
    const data = await api("/api/admin/monthly-votes/prepare", {
      method: "POST",
      body: { period, force: true },
    });
    monthlyRun = data.run || null;
    monthlyRankings = Array.isArray(data.rankings) ? data.rankings : [];
    setFeedback(monthlyEls.feedback, "Le classement a été préparé. Vérifie l’aperçu avant de créer les livraisons.", "success");
    renderMonthlyState();
  } catch (error) {
    setFeedback(monthlyEls.feedback, error.message, "error");
  } finally {
    setLoading(monthlyEls.prepare, false);
  }
}

async function approveMonthlyRewards() {
  if (!monthlyRun?.id) return;
  const readyCount = monthlyRankings.filter((row) => row.status === "ready").length;
  if (!confirm(`Créer maintenant les livraisons pour ${readyCount} joueur(s) du classement ${monthlyRun.period} ? Cette action est protégée contre les doublons.`)) return;
  setLoading(monthlyEls.approve, true, "Création des livraisons…");
  setFeedback(monthlyEls.feedback, "Création des livraisons mensuelles en cours…", "loading");
  try {
    const data = await api(`/api/admin/monthly-votes/${encodeURIComponent(monthlyRun.id)}/approve`, { method: "POST" });
    monthlyRun = data.run || monthlyRun;
    monthlyRankings = Array.isArray(data.rankings) ? data.rankings : monthlyRankings;
    const summary = data.summary || {};
    setFeedback(
      monthlyEls.feedback,
      `${summary.created || 0} livraison(s) créée(s), ${summary.skipped || 0} ignorée(s), ${summary.failed || 0} en échec.`,
      summary.failed ? "error" : "success"
    );
    renderMonthlyState();
  } catch (error) {
    setFeedback(monthlyEls.feedback, error.message, "error");
  } finally {
    setLoading(monthlyEls.approve, false);
  }
}

async function checkAccess() {
  showOnly(els.loading);
  try {
    const response = await fetch("/api/commandement/access", { credentials: "same-origin", cache: "no-store", headers: { Accept: "application/json" } });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401 || response.status === 403 || data.authorized !== true) { showOnly(els.denied); return; }
    if (!response.ok) throw new Error(data.error || `Erreur ${response.status}`);
    showOnly(els.workspace); resetForm(); await Promise.all([loadRules(), loadMonthlyStatus()]);
  } catch (error) { byId("rewardsAccessErrorMessage").textContent = error.message; showOnly(els.error); }
}

els.form.addEventListener("submit", saveRule);
els.addItem.addEventListener("click", () => { addItemRow(els.items); updatePreview(); });

els.cancel.addEventListener("click", () => resetForm());
els.refresh.addEventListener("click", loadRules);
els.newRule?.addEventListener("click", () => { resetForm(); document.querySelectorAll("[data-open-reward]").forEach((node) => node.classList.remove("is-selected")); document.querySelector(".rewards-editor-card")?.scrollIntoView({ behavior: "smooth", block: "start" }); els.name.focus(); });
els.search.addEventListener("input", render);
els.filter.addEventListener("change", render);
els.type.addEventListener("change", () => { updateApplicationFields(); updatePreview(); });
els.modeTabs.forEach((button) => button.addEventListener("click", () => selectMode(button.dataset.rewardMode)));
[els.name, els.rankMin, els.rankMax, els.thresholdValue, els.roubles, els.bitcoin, els.xp].forEach((node) => {
  node.addEventListener("input", updatePreview);
  node.addEventListener("change", updatePreview);
});
els.items.addEventListener("input", updatePreview);
els.items.addEventListener("change", updatePreview);
els.items.addEventListener("click", () => queueMicrotask(updatePreview));
byId("rewardsRetryAccess").addEventListener("click", checkAccess);

function openRule(id) {
  const rule = rules.find((entry) => entry.id === id);
  if (!rule) return;
  resetForm(rule);
  document.querySelectorAll("[data-open-reward]").forEach((node) => node.classList.toggle("is-selected", node.dataset.openReward === id));
  document.querySelector(".rewards-editor-card")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

document.addEventListener("click", (event) => {
  const remove = event.target.closest("[data-delete-reward]");
  if (remove) { deleteRule(remove.dataset.deleteReward); return; }
  const duplicate = event.target.closest("[data-duplicate-reward]");
  if (duplicate) { duplicateRule(duplicate.dataset.duplicateReward); return; }
  const edit = event.target.closest("[data-edit-reward]");
  if (edit) { openRule(edit.dataset.editReward); return; }
  const card = event.target.closest("[data-open-reward]");
  if (card) openRule(card.dataset.openReward);
});
document.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const card = event.target.closest("[data-open-reward]");
  if (!card || event.target.closest("button")) return;
  event.preventDefault();
  openRule(card.dataset.openReward);
});
monthlyEls.prepare?.addEventListener("click", prepareMonthlyRanking);
monthlyEls.approve?.addEventListener("click", approveMonthlyRewards);
monthlyEls.refresh?.addEventListener("click", loadMonthlyStatus);
monthlyEls.period?.addEventListener("change", loadMonthlyStatus);

checkAccess();
