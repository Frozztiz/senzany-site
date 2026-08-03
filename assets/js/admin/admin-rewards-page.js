const byId = (id) => document.getElementById(id);
let rules = [];
let saving = false;

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
}

function showOnly(id) {
  ["rewardsAccessLoading", "rewardsAccessDenied", "rewardsAccessError", "rewardsWorkspace"].forEach((key) => {
    byId(key).hidden = key !== id;
  });
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
  if (!response.ok) throw new Error(data.error || `Erreur ${response.status}`);
  return data;
}

function typeLabel(type) {
  return ({ votes: "Votes", event: "Événement", fidelity: "Fidélité", battle_pass: "Battle Pass", compensation: "Compensation" })[type] || type;
}

function rankLabel(rule) {
  return Number(rule.rank_min) === Number(rule.rank_max) ? `Rang ${rule.rank_min}` : `Rangs ${rule.rank_min} à ${rule.rank_max}`;
}

function itemsText(items) {
  if (!Array.isArray(items) || items.length === 0) return "Aucun objet";
  return items.map((item) => `${item.classname} ×${item.quantity}`).join(" · ");
}

function filteredRules() {
  const query = String(byId("rewardsSearch").value || "").trim().toLocaleLowerCase("fr-FR");
  const type = byId("rewardsTypeFilter").value;
  return rules.filter((rule) => {
    if (type && rule.reward_type !== type) return false;
    if (!query) return true;
    return [rule.name, rule.description, typeLabel(rule.reward_type), rankLabel(rule), itemsText(rule.items)].join(" ").toLocaleLowerCase("fr-FR").includes(query);
  });
}

function render() {
  const filtered = filteredRules();
  byId("rewardsTotal").textContent = rules.length;
  byId("rewardsActive").textContent = rules.filter((rule) => rule.is_active).length;
  byId("rewardsVotes").textContent = rules.filter((rule) => rule.reward_type === "votes").length;
  byId("rewardsList").innerHTML = filtered.length ? filtered.map((rule) => `
    <article class="reward-card ${rule.is_active ? "is-active" : "is-inactive"}">
      <div class="reward-card__top"><span>${escapeHtml(typeLabel(rule.reward_type))}</span><em>${rule.is_active ? "ACTIF" : "DÉSACTIVÉ"}</em></div>
      <div class="reward-card__title"><div><strong>${escapeHtml(rule.name)}</strong><small>${escapeHtml(rankLabel(rule))}</small></div><b>${Number(rule.roubles || 0).toLocaleString("fr-FR")} ₽</b></div>
      <p>${escapeHtml(rule.description || "Aucune description.")}</p>
      <dl><div><dt>XP Battle Pass</dt><dd>${Number(rule.battle_pass_xp || 0).toLocaleString("fr-FR")}</dd></div><div><dt>Priorité</dt><dd>${Number(rule.priority || 0)}</dd></div></dl>
      <div class="reward-card__items"><span>OBJETS</span><small>${escapeHtml(itemsText(rule.items))}</small></div>
      <div class="reward-card__actions"><button type="button" class="admin-button admin-button--small" data-edit-reward="${rule.id}">Modifier</button><button type="button" class="admin-button admin-button--small admin-button--danger" data-delete-reward="${rule.id}">Supprimer</button></div>
    </article>`).join("") : '<div class="admin-list-message">Aucune récompense ne correspond aux filtres.</div>';
}

function parseItems(text) {
  return String(text || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
    const [classname, quantity] = line.split("|").map((part) => part.trim());
    return { classname, quantity: Math.max(1, Number.parseInt(quantity || "1", 10) || 1) };
  }).filter((item) => item.classname);
}

function resetForm(rule = null) {
  byId("rewardId").value = rule?.id || "";
  byId("rewardType").value = rule?.reward_type || "votes";
  byId("rewardName").value = rule?.name || "";
  byId("rewardRankMin").value = rule?.rank_min || 1;
  byId("rewardRankMax").value = rule?.rank_max || 1;
  byId("rewardRoubles").value = rule?.roubles || 0;
  byId("rewardBattlePassXp").value = rule?.battle_pass_xp || 0;
  byId("rewardPriority").value = rule?.priority ?? 100;
  byId("rewardActive").checked = rule?.is_active ?? true;
  byId("rewardDescription").value = rule?.description || "";
  byId("rewardItems").value = Array.isArray(rule?.items) ? rule.items.map((item) => `${item.classname} | ${item.quantity}`).join("\n") : "";
  byId("rewardEditorEyebrow").textContent = rule ? "MODIFICATION" : "NOUVELLE RÈGLE";
  byId("rewardEditorTitle").textContent = rule ? "Modifier la récompense" : "Créer une récompense";
  byId("rewardEditorFeedback").hidden = true;
}

function openEditor(rule = null) {
  resetForm(rule);
  byId("rewardEditor").showModal();
}

function closeEditor() {
  if (!saving) byId("rewardEditor").close();
}

async function loadRules() {
  const feedback = byId("rewardsFeedback");
  feedback.hidden = false;
  feedback.textContent = "Chargement des récompenses…";
  try {
    const data = await api("/api/admin/rewards");
    rules = Array.isArray(data.rules) ? data.rules : [];
    byId("rewardsUpdated").textContent = data.updatedAt ? new Date(data.updatedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "—";
    feedback.hidden = true;
    render();
  } catch (error) {
    feedback.hidden = false;
    feedback.dataset.state = "error";
    feedback.textContent = error.message;
  }
}

async function saveRule(event) {
  event.preventDefault();
  if (saving) return;
  saving = true;
  const id = byId("rewardId").value;
  const feedback = byId("rewardEditorFeedback");
  feedback.hidden = false;
  feedback.dataset.state = "loading";
  feedback.textContent = "Enregistrement…";
  const payload = {
    rewardType: byId("rewardType").value,
    name: byId("rewardName").value,
    rankMin: Number(byId("rewardRankMin").value),
    rankMax: Number(byId("rewardRankMax").value),
    roubles: Number(byId("rewardRoubles").value),
    battlePassXp: Number(byId("rewardBattlePassXp").value),
    priority: Number(byId("rewardPriority").value),
    isActive: byId("rewardActive").checked,
    description: byId("rewardDescription").value,
    items: parseItems(byId("rewardItems").value),
  };
  try {
    await api(id ? `/api/admin/rewards/${encodeURIComponent(id)}` : "/api/admin/rewards", { method: id ? "PUT" : "POST", body: payload });
    saving = false;
    closeEditor();
    await loadRules();
  } catch (error) {
    saving = false;
    feedback.dataset.state = "error";
    feedback.textContent = error.message;
  }
}

async function deleteRule(id) {
  const rule = rules.find((entry) => entry.id === id);
  if (!rule || !window.confirm(`Supprimer la récompense « ${rule.name} » ?`)) return;
  try {
    await api(`/api/admin/rewards/${encodeURIComponent(id)}`, { method: "DELETE" });
    await loadRules();
  } catch (error) { window.alert(error.message); }
}

async function checkAccess() {
  showOnly("rewardsAccessLoading");
  try {
    const response = await fetch("/api/commandement/access", { credentials: "same-origin", cache: "no-store", headers: { Accept: "application/json" } });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401 || response.status === 403 || data.authorized !== true) { showOnly("rewardsAccessDenied"); return; }
    if (!response.ok) throw new Error(data.error || `Erreur ${response.status}`);
    showOnly("rewardsWorkspace");
    await loadRules();
  } catch (error) {
    byId("rewardsAccessErrorMessage").textContent = error.message;
    showOnly("rewardsAccessError");
  }
}

document.addEventListener("click", (event) => {
  const edit = event.target.closest("[data-edit-reward]");
  if (edit) openEditor(rules.find((rule) => rule.id === edit.dataset.editReward));
  const remove = event.target.closest("[data-delete-reward]");
  if (remove) deleteRule(remove.dataset.deleteReward);
  if (event.target.closest("[data-close-reward]")) closeEditor();
});

byId("createRewardRule").addEventListener("click", () => openEditor());
byId("refreshRewards").addEventListener("click", loadRules);
byId("rewardsRetryAccess").addEventListener("click", checkAccess);
byId("rewardsSearch").addEventListener("input", render);
byId("rewardsTypeFilter").addEventListener("change", render);
byId("rewardForm").addEventListener("submit", saveRule);
checkAccess();
