let cachedPayload = null;

const el = (id) => document.getElementById(id);
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[char]));

function render() {
  if (!cachedPayload) return;
  const query = String(el("adminVotesSearch")?.value || "").trim().toLowerCase();
  const identified = (cachedPayload.identified || []).filter((row) => [row.playerName, row.steamId, ...(row.aliases || [])].join(" ").toLowerCase().includes(query));
  const unknown = (cachedPayload.unidentified || []).filter((row) => String(row.playerName || "").toLowerCase().includes(query));

  el("adminVotesIdentifiedList").innerHTML = identified.length ? identified.map((row) => `
    <article class="admin-vote-row">
      <b>#${row.position}</b><div><strong>${escapeHtml(row.playerName)}</strong><small>${escapeHtml((row.aliases || []).join(", "))}</small></div><em>${Number(row.votes || 0)} votes</em>
    </article>`).join("") : '<div class="admin-list-message">Aucun membre trouvé.</div>';

  el("adminVotesUnknownList").innerHTML = unknown.length ? unknown.map((row) => `
    <article class="admin-vote-row admin-vote-row--unknown">
      <b>#${Number(row.position || 0)}</b><div><strong>${escapeHtml(row.playerName)}</strong><small>Non rattaché à un profil Senzany</small></div><em>${Number(row.votes || 0)} votes</em>
    </article>`).join("") : '<div class="admin-list-message">Aucun pseudo non identifié.</div>';
}

export async function loadVotes() {
  const feedback = el("adminVotesFeedback");
  if (feedback) { feedback.hidden = false; feedback.textContent = "Synchronisation avec Top-Serveurs…"; }
  const response = await fetch("/api/commandement/votes", { credentials: "same-origin", cache: "no-store", headers: { Accept: "application/json" } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Erreur ${response.status}`);
  cachedPayload = payload;
  if (feedback) feedback.hidden = true;
  el("adminVotesTotal").textContent = payload.totals?.votes ?? 0;
  el("adminVotesIdentified").textContent = payload.totals?.identifiedPlayers ?? 0;
  el("adminVotesUnknown").textContent = payload.totals?.unidentifiedNames ?? 0;
  el("adminVotesUpdated").textContent = payload.updatedAt ? new Date(payload.updatedAt).toLocaleTimeString("fr-FR", {hour:"2-digit",minute:"2-digit"}) : "--:--";
  const card = el("commandVotesCardCount"); if (card) card.textContent = payload.totals?.votes ?? 0;
  render();
}

export function initializeVotes({ onBack } = {}) {
  el("backToAdminHomeFromVotes")?.addEventListener("click", onBack);
  el("refreshAdminVotes")?.addEventListener("click", () => loadVotes().catch(showError));
  el("adminVotesSearch")?.addEventListener("input", render);
}

function showError(error) {
  const feedback = el("adminVotesFeedback");
  if (feedback) { feedback.hidden = false; feedback.textContent = error.message || "Classement indisponible."; }
}
