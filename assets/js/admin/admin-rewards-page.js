import { addItemRow, clearItemRows, getItemsFromContainer, escapeHtml } from "./items.js";

const byId = (id) => document.getElementById(id);
let rules = [];
let saving = false;

const els = {
  loading: byId("rewardsAccessLoading"), denied: byId("rewardsAccessDenied"), error: byId("rewardsAccessError"), workspace: byId("rewardsWorkspace"),
  form: byId("rewardForm"), id: byId("rewardId"), type: byId("rewardType"), name: byId("rewardName"),
  rankingFields: byId("rewardRankingFields"), thresholdFields: byId("rewardThresholdFields"),
  rankMin: byId("rewardRankMin"), rankMax: byId("rewardRankMax"), thresholdValue: byId("rewardThresholdValue"),
  roubles: byId("rewardRoubles"), xp: byId("rewardBattlePassXp"), description: byId("rewardDescription"), active: byId("rewardActive"), priority: byId("rewardPriority"),
  items: byId("rewardItemsList"), addItem: byId("addRewardItem"), save: byId("saveRewardRule"), cancel: byId("cancelRewardEdit"), formFeedback: byId("rewardFormFeedback"),
  list: byId("rewardsList"), feedback: byId("rewardsFeedback"), search: byId("rewardsSearch"), filter: byId("rewardsTypeFilter"), refresh: byId("refreshRewards"),
  rankingsCount: byId("rewardsRankings"), thresholdsCount: byId("rewardsThresholds"), battlePassCount: byId("rewardsBattlePass"), eventsCount: byId("rewardsEvents"),
  previewName: byId("rewardPreviewName"), previewType: byId("rewardPreviewType"), previewApplication: byId("rewardPreviewApplication"),
  previewRoubles: byId("rewardPreviewRoubles"), previewXp: byId("rewardPreviewXp"), previewItems: byId("rewardPreviewItems"),
};

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

function updateApplicationFields() {
  const ranking = isRankingType(els.type.value);
  const threshold = isThresholdType(els.type.value);
  els.rankingFields.hidden = !ranking;
  els.thresholdFields.hidden = !threshold;
  els.rankMin.required = ranking;
  els.rankMax.required = ranking;
  els.thresholdValue.required = threshold;
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

function renderRule(rule) {
  const items = normalizeItems(rule.items);
  const article = document.createElement("article");
  article.className = `reward-rule ${rule.is_active ? "is-active" : "is-inactive"}`;
  article.dataset.openReward = rule.id;
  article.tabIndex = 0;
  article.innerHTML = `
    <div class="reward-rule__top">
      <div><span>${escapeHtml(typeLabel(rule.reward_type))}</span><h3>${escapeHtml(rule.name)}</h3><small>${escapeHtml(applicationLabel(rule))}</small></div>
      <em>${rule.is_active ? "ACTIF" : "DÉSACTIVÉ"}</em>
    </div>
    ${rule.description ? `<p class="reward-rule__message">${escapeHtml(rule.description)}</p>` : ""}
    <div class="reward-rule__values">
      <div><span>Roubles</span><strong>${formatNumber(rule.roubles)} ₽</strong></div>
      <div><span>XP Battle Pass</span><strong>${formatNumber(rule.battle_pass_xp)}</strong></div>
    </div>
    <div class="reward-rule__items">
      <span>OBJETS DU PACK</span>
      <div>${items.length ? items.map((item) => `<small>${escapeHtml(item.className)} × ${item.quantity}</small>`).join("") : "<small>Aucun objet configuré</small>"}</div>
    </div>
    <div class="reward-rule__actions">
      <button type="button" class="admin-button admin-button--small" data-edit-reward="${escapeHtml(rule.id)}">Modifier</button>
      <button type="button" class="admin-button admin-button--small admin-button--danger" data-delete-reward="${escapeHtml(rule.id)}">Supprimer</button>
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
  saving = true; setLoading(els.save, true, "Enregistrement…");
  const id = els.id.value;
  const payload = {
    rewardType, name: els.name.value.trim(),
    rankMin: isRankingType(rewardType) ? rankMin : 1,
    rankMax: isRankingType(rewardType) ? rankMax : 1,
    thresholdValue: isThresholdType(rewardType) ? thresholdValue : null,
    roubles: Number(els.roubles.value || 0), battlePassXp: Number(els.xp.value || 0),
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

async function deleteRule(id) {
  const rule = rules.find((entry) => entry.id === id);
  if (!rule || !confirm(`Supprimer le pack « ${rule.name} » ?`)) return;
  try { await api(`/api/admin/rewards/${encodeURIComponent(id)}`, { method: "DELETE" }); await loadRules(); }
  catch (error) { alert(error.message); }
}

async function checkAccess() {
  showOnly(els.loading);
  try {
    const response = await fetch("/api/commandement/access", { credentials: "same-origin", cache: "no-store", headers: { Accept: "application/json" } });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401 || response.status === 403 || data.authorized !== true) { showOnly(els.denied); return; }
    if (!response.ok) throw new Error(data.error || `Erreur ${response.status}`);
    showOnly(els.workspace); resetForm(); await loadRules();
  } catch (error) { byId("rewardsAccessErrorMessage").textContent = error.message; showOnly(els.error); }
}

els.form.addEventListener("submit", saveRule);
els.addItem.addEventListener("click", () => { addItemRow(els.items); updatePreview(); });
els.cancel.addEventListener("click", () => resetForm());
els.refresh.addEventListener("click", loadRules);
els.search.addEventListener("input", render);
els.filter.addEventListener("change", render);
els.type.addEventListener("change", () => { updateApplicationFields(); updatePreview(); });
[els.name, els.rankMin, els.rankMax, els.thresholdValue, els.roubles, els.xp].forEach((node) => {
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
  document.querySelector(".rewards-editor-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

document.addEventListener("click", (event) => {
  const remove = event.target.closest("[data-delete-reward]");
  if (remove) { deleteRule(remove.dataset.deleteReward); return; }
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
checkAccess();
