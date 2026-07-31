const AUTO_REFRESH_MS = 20000;

let refreshTimer = null;
let requestInFlight = false;
let currentPlayers = [];
let currentSearch = "";
let selectedPlayer = null;
let actionInFlight = false;

const elements = {
    count: document.getElementById("commandPlayersCount"),
    cardCount: document.getElementById("commandPlayersCardCount"),
    updatedAt: document.getElementById("commandPlayersUpdatedAt"),
    status: document.getElementById("commandPlayersStatus"),
    list: document.getElementById("commandPlayersList"),
    search: document.getElementById("commandPlayersSearch"),
    refreshButton: document.getElementById("refreshCommandPlayers"),
    backButton: document.getElementById("backFromPlayers"),
    modal: document.getElementById("commandPlayerModal"),
    modalName: document.getElementById("commandPlayerModalName"),
    modalPing: document.getElementById("commandPlayerModalPing"),
    modalTime: document.getElementById("commandPlayerModalTime"),
    modalGuid: document.getElementById("commandPlayerModalGuid"),
    identityNote: document.getElementById("commandPlayerIdentityNote"),
    steamStatus: document.getElementById("commandPlayerSteamStatus"),
    steamId: document.getElementById("commandPlayerSteamId"),
    discordStatus: document.getElementById("commandPlayerDiscordStatus"),
    discordName: document.getElementById("commandPlayerDiscordName"),
    reason: document.getElementById("commandPlayerActionReason"),
    banDuration: document.getElementById("commandPlayerBanDuration"),
    kick: document.getElementById("commandPlayerKick"),
    tempBan: document.getElementById("commandPlayerTempBan"),
    permanentBan: document.getElementById("commandPlayerPermanentBan"),
    feedback: document.getElementById("commandPlayerActionFeedback")
};

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function formatDuration(seconds) {
    const value = Number(seconds);
    if (!Number.isFinite(value) || value < 0) return "—";
    if (value < 60) return "< 1 min";
    const totalMinutes = Math.floor(value / 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return hours > 0 ? `${hours} h ${String(minutes).padStart(2, "0")}` : `${minutes} min`;
}

function getPingClass(ping) {
    const value = Number(ping);
    if (!Number.isFinite(value)) return "";
    if (value <= 60) return "command-player-ping--good";
    if (value <= 120) return "command-player-ping--medium";
    return "command-player-ping--high";
}

function formatUpdatedAt(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "--:--:--";
    return new Intl.DateTimeFormat("fr-FR", {
        hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false
    }).format(date);
}

function normalizeSearch(value) {
    return String(value || "").trim().toLocaleLowerCase("fr-FR");
}

function setLinkStatus(element, linked, linkedText, unlinkedText) {
    if (!element) return;
    element.textContent = linked ? linkedText : unlinkedText;
    element.classList.toggle("is-linked", Boolean(linked));
    element.classList.toggle("is-unlinked", !linked);
}

function resetIdentity() {
    if (elements.identityNote) elements.identityNote.textContent = "Vérification…";
    if (elements.steamStatus) {
        elements.steamStatus.textContent = "Vérification…";
        elements.steamStatus.className = "";
    }
    if (elements.steamId) elements.steamId.textContent = "—";
    if (elements.discordStatus) {
        elements.discordStatus.textContent = "Vérification…";
        elements.discordStatus.className = "";
    }
    if (elements.discordName) elements.discordName.textContent = "—";
}

async function loadPlayerIdentity(player) {
    resetIdentity();
    try {
        const response = await fetch(`/api/commandement/players/${encodeURIComponent(player.id)}/identity`, {
            credentials: "same-origin", cache: "no-store", headers: { Accept: "application/json" }
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || `Erreur ${response.status}`);

        const identity = payload.identity || {};
        if (!identity.matched) {
            setLinkStatus(elements.steamStatus, false, "Lié", "Non identifié");
            setLinkStatus(elements.discordStatus, false, "Lié", "Non identifié");
            if (elements.identityNote) {
                elements.identityNote.textContent = identity.ambiguous
                    ? "Plusieurs comptes Steam portent ce pseudo"
                    : "Aucune correspondance exacte dans le portail";
            }
            return;
        }

        setLinkStatus(elements.steamStatus, identity.steamLinked, "Lié au portail", "Non lié");
        setLinkStatus(elements.discordStatus, identity.discordLinked, "Lié au portail", "Non lié");
        if (elements.steamId) elements.steamId.textContent = identity.steamId || "—";
        if (elements.discordName) elements.discordName.textContent = identity.discordUsername || "—";
        if (elements.identityNote) elements.identityNote.textContent = "Correspondance confirmée par le pseudo Steam";
    } catch (error) {
        setLinkStatus(elements.steamStatus, false, "Lié", "Vérification impossible");
        setLinkStatus(elements.discordStatus, false, "Lié", "Vérification impossible");
        if (elements.identityNote) elements.identityNote.textContent = error.message || "Service indisponible";
    }
}

function openPlayerModal(player) {
    if (!elements.modal || !player) return;
    selectedPlayer = player;
    elements.modalName.textContent = player.name || "Joueur";
    elements.modalPing.textContent = player.ping == null ? "—" : `${player.ping} ms`;
    elements.modalTime.textContent = formatDuration(player.timeSeconds);
    elements.modalGuid.textContent = player.guid || "Non disponible";
    if (elements.reason) elements.reason.value = "";
    if (elements.feedback) elements.feedback.hidden = true;
    elements.modal.hidden = false;
    document.body.classList.add("command-player-modal-open");
    loadPlayerIdentity(player);
}

function closePlayerModal() {
    if (!elements.modal || actionInFlight) return;
    elements.modal.hidden = true;
    selectedPlayer = null;
    document.body.classList.remove("command-player-modal-open");
}

function renderPlayerRows() {
    if (!elements.list) return;
    const filtered = currentPlayers.filter((player) => normalizeSearch(player.name).includes(currentSearch));

    if (filtered.length === 0) {
        elements.list.innerHTML = currentSearch
            ? '<div class="command-players-empty">Aucun joueur ne correspond à cette recherche.</div>'
            : '<div class="command-players-empty">Aucun joueur connecté actuellement.</div>';
        return;
    }

    elements.list.innerHTML = filtered.map((player, index) => `
        <article class="command-player-row command-player-row--clickable" data-player-index="${currentPlayers.indexOf(player)}" tabindex="0" role="button" aria-label="Ouvrir la fiche de ${escapeHtml(player.name)}">
            <div class="command-player-row__rank">${String(index + 1).padStart(2, "0")}</div>
            <div class="command-player-row__identity"><i aria-hidden="true"></i><div><strong>${escapeHtml(player.name)}</strong><span>SESSION DAYZ ACTIVE</span></div></div>
            <div class="command-player-ping ${getPingClass(player.ping)}"><span>PING</span><strong>${player.ping == null ? "—" : `${player.ping} ms`}</strong></div>
            <div><span>TEMPS</span><strong>${formatDuration(player.timeSeconds)}</strong></div>
        </article>`).join("");
}

function renderPlayers(payload) {
    currentPlayers = Array.isArray(payload.players) ? payload.players : [];
    const playerCount = Number.isFinite(Number(payload.playerCount)) ? Number(payload.playerCount) : currentPlayers.length;
    const maxPlayers = Number.isFinite(Number(payload.maxPlayers)) ? Number(payload.maxPlayers) : "--";
    const countLabel = `${playerCount} / ${maxPlayers}`;
    if (elements.count) elements.count.textContent = countLabel;
    if (elements.cardCount) elements.cardCount.textContent = countLabel;
    if (elements.updatedAt) elements.updatedAt.textContent = formatUpdatedAt(payload.updatedAt);
    if (!elements.list || !elements.status) return;

    if (payload.online === false) {
        elements.status.textContent = "SERVEUR INJOIGNABLE";
        elements.status.className = "command-players-status command-players-status--danger";
        elements.list.innerHTML = '<div class="command-players-empty">Impossible de contacter le serveur DayZ.</div>';
        return;
    }

    elements.status.textContent = payload.degraded ? "DONNÉES DÉGRADÉES" : "CONNEXION ACTIVE";
    elements.status.className = payload.degraded ? "command-players-status command-players-status--warning" : "command-players-status";
    if (!payload.namesAvailable && playerCount > 0) {
        elements.list.innerHTML = '<div class="command-players-empty command-players-empty--warning"><strong>Liste indisponible</strong><span>Le serveur ne transmet pas actuellement les pseudos.</span></div>';
        return;
    }
    renderPlayerRows();
}

async function loadPlayers() {
    if (requestInFlight) return;
    requestInFlight = true;
    if (elements.refreshButton) { elements.refreshButton.disabled = true; elements.refreshButton.textContent = "Actualisation…"; }
    try {
        const response = await fetch("/api/commandement/players", { credentials: "same-origin", cache: "no-store", headers: { Accept: "application/json" } });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || `Erreur ${response.status}`);
        renderPlayers(payload);
    } catch (error) {
        if (elements.status) { elements.status.textContent = "ERREUR DE LIAISON"; elements.status.className = "command-players-status command-players-status--danger"; }
        if (elements.list) elements.list.innerHTML = `<div class="command-players-empty">${escapeHtml(error.message || "Impossible de charger les joueurs.")}</div>`;
    } finally {
        requestInFlight = false;
        if (elements.refreshButton) { elements.refreshButton.disabled = false; elements.refreshButton.textContent = "Actualiser"; }
    }
}

async function runPlayerAction(action) {
    if (!selectedPlayer || actionInFlight) return;
    const reason = String(elements.reason?.value || "").trim();
    if (!reason) {
        elements.reason?.focus();
        showActionFeedback("Le motif est obligatoire.", false);
        return;
    }

    const labels = { kick: "expulser", tempban: "bannir temporairement", permban: "bannir définitivement" };
    if (!window.confirm(`Confirmer : ${labels[action]} ${selectedPlayer.name} ?`)) return;

    actionInFlight = true;
    setActionButtonsDisabled(true);
    showActionFeedback("Transmission de la commande RCON…", true);

    try {
        const body = { action, reason };
        if (action === "tempban") body.minutes = Number(elements.banDuration?.value || 1440);
        const response = await fetch(`/api/commandement/players/${encodeURIComponent(selectedPlayer.id)}/action`, {
            method: "POST", credentials: "same-origin", cache: "no-store",
            headers: { Accept: "application/json", "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || `Erreur ${response.status}`);
        showActionFeedback("Commande transmise avec succès.", true);
        window.setTimeout(async () => { closePlayerModal(); await loadPlayers(); }, 900);
    } catch (error) {
        showActionFeedback(error.message || "La commande RCON a échoué.", false);
    } finally {
        actionInFlight = false;
        setActionButtonsDisabled(false);
    }
}

function setActionButtonsDisabled(disabled) {
    [elements.kick, elements.tempBan, elements.permanentBan, elements.reason, elements.banDuration].forEach((element) => { if (element) element.disabled = disabled; });
}

function showActionFeedback(message, success) {
    if (!elements.feedback) return;
    elements.feedback.textContent = message;
    elements.feedback.className = `command-player-action-feedback ${success ? "is-success" : "is-error"}`;
    elements.feedback.hidden = false;
}

export function initializePlayers({ onBack } = {}) {
    elements.refreshButton?.addEventListener("click", loadPlayers);
    elements.search?.addEventListener("input", (event) => { currentSearch = normalizeSearch(event.target.value); renderPlayerRows(); });
    elements.list?.addEventListener("click", (event) => { const row = event.target.closest("[data-player-index]"); if (row) openPlayerModal(currentPlayers[Number(row.dataset.playerIndex)]); });
    elements.list?.addEventListener("keydown", (event) => { if (event.key !== "Enter" && event.key !== " ") return; const row = event.target.closest("[data-player-index]"); if (!row) return; event.preventDefault(); openPlayerModal(currentPlayers[Number(row.dataset.playerIndex)]); });
    elements.modal?.addEventListener("click", (event) => { if (event.target.closest("[data-close-player-modal]")) closePlayerModal(); });
    elements.kick?.addEventListener("click", () => runPlayerAction("kick"));
    elements.tempBan?.addEventListener("click", () => runPlayerAction("tempban"));
    elements.permanentBan?.addEventListener("click", () => runPlayerAction("permban"));
    document.addEventListener("keydown", (event) => { if (event.key === "Escape") closePlayerModal(); });
    elements.backButton?.addEventListener("click", () => { stopPlayersAutoRefresh(); closePlayerModal(); onBack?.(); });
}

export async function openPlayers() {
    await loadPlayers();
    stopPlayersAutoRefresh();
    refreshTimer = window.setInterval(loadPlayers, AUTO_REFRESH_MS);
}

export function stopPlayersAutoRefresh() {
    if (refreshTimer) { window.clearInterval(refreshTimer); refreshTimer = null; }
}
