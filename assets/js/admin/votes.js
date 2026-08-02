let cachedPayload = null;

const el = (id) => document.getElementById(id);
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#039;",
}[char]));

function normalizedQuery() {
  return String(el("adminVotesSearch")?.value || "").trim().toLocaleLowerCase("fr-FR");
}

function filteredRows() {
  const query = normalizedQuery();
  const identified = (cachedPayload?.identified || []).filter((row) =>
    [row.playerName, row.steamId, ...(row.aliases || []), ...(row.matchedNames || [])]
      .join(" ")
      .toLocaleLowerCase("fr-FR")
      .includes(query)
  );
  const unknown = (cachedPayload?.unidentified || []).filter((row) =>
    String(row.playerName || "").toLocaleLowerCase("fr-FR").includes(query)
  );
  return { identified, unknown };
}

function render() {
  if (!cachedPayload) return;
  const { identified, unknown } = filteredRows();

  el("adminVotesIdentifiedList").innerHTML = identified.length
    ? identified.map((row) => `
      <article class="admin-vote-row">
        <b>#${Number(row.position || 0)}</b>
        <div>
          <strong>${escapeHtml(row.playerName)}</strong>
          <small>${escapeHtml((row.aliases || []).join(", "))}</small>
          <small>SteamID : ${escapeHtml(row.steamId || "—")}</small>
        </div>
        <em>${Number(row.votes || 0)} votes</em>
      </article>`).join("")
    : '<div class="admin-list-message">Aucun membre trouvé.</div>';

  el("adminVotesUnknownList").innerHTML = unknown.length
    ? unknown.map((row) => `
      <article class="admin-vote-row admin-vote-row--unknown">
        <b>#${Number(row.position || 0)}</b>
        <div>
          <strong>${escapeHtml(row.playerName)}</strong>
          <small>Non rattaché à un profil Senzany</small>
        </div>
        <em>${Number(row.votes || 0)} votes</em>
      </article>`).join("")
    : '<div class="admin-list-message">Aucun pseudo non identifié.</div>';
}

function csvCell(value) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function exportCsv() {
  if (!cachedPayload) return;
  const lines = [
    ["Type", "Rang", "Membre", "SteamID", "Pseudos déclarés", "Pseudo Top-Serveurs", "Votes"],
  ];

  for (const row of cachedPayload.identified || []) {
    lines.push([
      "Identifié",
      row.position,
      row.playerName,
      row.steamId,
      (row.aliases || []).join(" | "),
      (row.matchedNames || []).join(" | "),
      row.votes,
    ]);
  }

  for (const row of cachedPayload.unidentified || []) {
    lines.push([
      "Non identifié",
      row.position,
      "",
      "",
      "",
      row.playerName,
      row.votes,
    ]);
  }

  const csv = `\uFEFF${lines.map((line) => line.map(csvCell).join(";")).join("\r\n")}`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `senzany-votes-${date}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function loadVotes() {
  const feedback = el("adminVotesFeedback");
  if (feedback) {
    feedback.hidden = false;
    feedback.textContent = "Synchronisation avec Top-Serveurs…";
  }

  const response = await fetch("/api/commandement/votes", {
    credentials: "same-origin",
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Erreur ${response.status}`);

  cachedPayload = payload;
  if (feedback) feedback.hidden = true;
  el("adminVotesTotal").textContent = payload.totals?.votes ?? 0;
  el("adminVotesIdentified").textContent = payload.totals?.identifiedPlayers ?? 0;
  el("adminVotesUnknown").textContent = payload.totals?.unidentifiedNames ?? 0;
  el("adminVotesUpdated").textContent = payload.updatedAt
    ? new Date(payload.updatedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
    : "--:--";

  const card = el("commandVotesCardCount");
  if (card) card.textContent = payload.totals?.votes ?? 0;
  render();
}

export function initializeVotes({ onBack } = {}) {
  el("backToAdminHomeFromVotes")?.addEventListener("click", onBack);
  el("refreshAdminVotes")?.addEventListener("click", () => loadVotes().catch(showError));
  el("exportAdminVotes")?.addEventListener("click", exportCsv);
  el("adminVotesSearch")?.addEventListener("input", render);
}

function showError(error) {
  const feedback = el("adminVotesFeedback");
  if (feedback) {
    feedback.hidden = false;
    feedback.textContent = error.message || "Classement indisponible.";
  }
}
