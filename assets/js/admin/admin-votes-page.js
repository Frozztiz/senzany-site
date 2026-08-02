const byId = (id) => document.getElementById(id);
let payload = null;

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
const number = (value) => Number(value || 0);

function setSyncState(state, label) {
  const container = document.querySelector(".votes-admin-sync");
  if (container) {
    container.dataset.state = state;
  }
  byId("votesSyncState").textContent = label;
}

function setRefreshLoading(loading) {
  const button = byId("votesRefresh");
  if (!button) return;
  button.disabled = loading;
  button.classList.toggle("is-loading", loading);
  const label = button.querySelector("span");
  if (label) label.textContent = loading ? "Synchronisation…" : "Actualiser";
}

function setView(name) {
  byId("votesAccessLoading").hidden = name !== "loading";
  byId("votesAccessDenied").hidden = name !== "denied";
  byId("votesAccessError").hidden = name !== "error";
  byId("votesDashboard").hidden = name !== "dashboard";
}

async function checkAccess() {
  setView("loading");
  try {
    const response = await fetch("/api/commandement/access", { credentials: "same-origin", cache: "no-store", headers: { Accept: "application/json" } });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) { window.location.href = "/api/steam/login"; return; }
    if (response.status === 403 || data.authorized !== true) { setView("denied"); return; }
    if (!response.ok) throw new Error(data.error || `Erreur ${response.status}`);
    setView("dashboard");
    await loadVotes();
  } catch (error) {
    byId("votesAccessErrorMessage").textContent = error.message || "Impossible de vérifier l’accès.";
    setView("error");
  }
}

function associationRate() {
  const linked = number(payload?.totals?.identifiedPlayers);
  const unknown = number(payload?.totals?.unidentifiedNames);
  const total = linked + unknown;
  return total ? Math.round((linked / total) * 100) : 0;
}

function searchValue() { return String(byId("votesSearch").value || "").trim().toLocaleLowerCase("fr-FR"); }

function filteredData() {
  const query = searchValue();
  let linked = [...(payload?.identified || [])];
  let unknown = [...(payload?.unidentified || [])];
  if (query) {
    linked = linked.filter((row) => [row.playerName, row.steamId, ...(row.aliases || []), ...(row.matchedNames || [])].join(" ").toLocaleLowerCase("fr-FR").includes(query));
    unknown = unknown.filter((row) => String(row.playerName || "").toLocaleLowerCase("fr-FR").includes(query));
  }
  if (byId("votesOnlyLinked").checked) unknown = [];
  if (byId("votesOnlyUnknown").checked) linked = [];
  if (byId("votesTop10").checked) { linked = linked.slice(0, 10); unknown = unknown.slice(0, 10); }
  return { linked, unknown };
}

function renderLinkedCard(row) {
  const aliases = row.aliases || [];
  const matched = new Set((row.matchedNames || []).map((name) => name.toLocaleLowerCase("fr-FR")));
  const aliasRows = aliases.map((alias) => `<li><span>${escapeHtml(alias)}</span><em>${matched.has(String(alias).toLocaleLowerCase("fr-FR")) ? "RETROUVÉ" : "NON RETROUVÉ"}</em></li>`).join("");
  const hasSteam = Boolean(row.steamId);
  const hasDiscord = Boolean(row.playerName && row.playerName !== row.steamId);
  return `<article class="votes-member-card">
    <div class="votes-member-card__rank">#${number(row.position)}</div>
    <div class="votes-member-card__head"><div><strong>${escapeHtml(row.playerName)}</strong><small>SteamID ${escapeHtml(row.steamId || "—")}</small><div class="votes-member-card__links"><span class="${hasSteam ? "is-online" : "is-offline"}"><i>S</i>Steam</span><span class="${hasDiscord ? "is-online" : "is-offline"}"><i>D</i>Discord</span></div></div><b>${number(row.votes)} <span>votes</span></b></div>
    <div class="votes-member-card__body"><span>PSEUDOS DÉCLARÉS</span><ul>${aliasRows || "<li><span>Aucun pseudo</span></li>"}</ul></div>
    <div class="votes-member-card__footer"><span>${aliases.length} pseudo${aliases.length > 1 ? "s" : ""}</span><span>${(row.matchedNames || []).length} retrouvé${(row.matchedNames || []).length > 1 ? "s" : ""}</span></div>
  </article>`;
}

function renderUnknownCard(row) {
  return `<article class="votes-unknown-card"><b>#${number(row.position)}</b><div><strong>${escapeHtml(row.playerName)}</strong><small>Non rattaché à un profil Senzany</small></div><em>${number(row.votes)} <span>votes</span></em></article>`;
}

function render() {
  if (!payload) return;
  const { linked, unknown } = filteredData();
  byId("votesLinkedCount").textContent = linked.length;
  byId("votesUnknownCount").textContent = unknown.length;
  byId("votesLinkedList").innerHTML = linked.length ? linked.map(renderLinkedCard).join("") : '<div class="admin-list-message">Aucun membre correspondant.</div>';
  byId("votesUnknownList").innerHTML = unknown.length ? unknown.map(renderUnknownCard).join("") : '<div class="admin-list-message">Aucun pseudo correspondant.</div>';
}

function csvCell(value) { return `"${String(value ?? "").replace(/"/g, '""')}"`; }
function exportCsv() {
  if (!payload) return;
  const rows = [["Type", "Rang", "Membre", "SteamID", "Pseudos déclarés", "Pseudos retrouvés", "Votes"]];
  for (const row of payload.identified || []) rows.push(["Identifié", row.position, row.playerName, row.steamId, (row.aliases || []).join(" | "), (row.matchedNames || []).join(" | "), row.votes]);
  for (const row of payload.unidentified || []) rows.push(["Non identifié", row.position, "", "", "", row.playerName, row.votes]);
  const blob = new Blob([`\uFEFF${rows.map((r) => r.map(csvCell).join(";")).join("\r\n")}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob); const link = document.createElement("a");
  link.href = url; link.download = `senzany-votes-${new Date().toISOString().slice(0, 10)}.csv`; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
}

async function loadVotes() {
  byId("votesFeedback").hidden = false;
  byId("votesFeedback").textContent = "Synchronisation avec Top-Serveurs…";
  setSyncState("loading", "SYNCHRONISATION");
  setRefreshLoading(true);
  try {
    const response = await fetch("/api/commandement/votes", { credentials: "same-origin", cache: "no-store", headers: { Accept: "application/json" } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Erreur ${response.status}`);
    payload = data;
    byId("votesTotal").textContent = number(data.totals?.votes);
    byId("votesLinked").textContent = number(data.totals?.identifiedPlayers);
    byId("votesUnknown").textContent = number(data.totals?.unidentifiedNames);
    byId("votesRate").textContent = `${associationRate()} %`;
    byId("votesUpdated").textContent = data.updatedAt ? new Date(data.updatedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "—";
    setSyncState("success", "SYNCHRONISÉ");
    byId("votesFeedback").hidden = true;
    render();
  } finally {
    setRefreshLoading(false);
  }
}

function showLoadError(error) {
  byId("votesFeedback").hidden = false;
  byId("votesFeedback").textContent = error.message || "Classement indisponible.";
  setSyncState("error", "INDISPONIBLE");
  setRefreshLoading(false);
}

byId("votesRetry")?.addEventListener("click", checkAccess);
byId("votesRefresh")?.addEventListener("click", () => loadVotes().catch(showLoadError));
byId("votesExport")?.addEventListener("click", exportCsv);
["votesSearch", "votesOnlyLinked", "votesOnlyUnknown", "votesTop10"].forEach((id) => byId(id)?.addEventListener(id === "votesSearch" ? "input" : "change", render));
checkAccess();
