/**
 * SENZANY
 * Module Livraisons V3.1
 */

import {
    show,
    hide,
    showFeedback,
    clearFeedback,
    setLoading
} from "./ui.js";

import {
    addItemRow,
    clearItemRows,
    getItemsFromContainer,
    escapeHtml
} from "./items.js";

const API_BASE = "/api/admin/deliveries";
const AUTO_REFRESH_MS = 30000;

const elements = {
    form: document.getElementById("deliveryForm"),
    steamId: document.getElementById("deliverySteamId"),
    playerName: document.getElementById("deliveryPlayerName"),
    title: document.getElementById("deliveryTitle"),
    message: document.getElementById("deliveryMessage"),
    itemsList: document.getElementById("deliveryItemsList"),
    addItemButton: document.getElementById("addDeliveryItem"),
    submitButton: document.getElementById("createDeliveryButton"),
    feedback: document.getElementById("deliveryFormFeedback"),
    statusFilter: document.getElementById("deliveryStatusFilter"),
    searchInput: document.getElementById("deliverySearchInput"),
    refreshButton: document.getElementById("refreshDeliveriesButton"),
    loading: document.getElementById("deliveriesLoading"),
    empty: document.getElementById("deliveriesEmpty"),
    list: document.getElementById("deliveriesList"),
    totalCount: document.getElementById("deliveryCountTotal"),
    pendingCount: document.getElementById("deliveryCountPending"),
    processingCount: document.getElementById("deliveryCountProcessing"),
    deliveredCount: document.getElementById("deliveryCountDelivered")
};

let allDeliveries = [];
let refreshTimer = null;
let searchTimer = null;

async function apiRequest(path = "", options = {}) {
    const response = await fetch(`${API_BASE}${path}`, {
        credentials: "same-origin",
        cache: "no-store",
        headers: {
            Accept: "application/json",
            ...(options.body ? { "Content-Type": "application/json" } : {}),
            ...(options.headers || {})
        },
        ...options
    });

    if (response.status === 204) {
        return null;
    }

    let data = null;
    try {
        data = await response.json();
    } catch (_) {
        data = null;
    }

    if (!response.ok) {
        throw new Error(data?.error || `Erreur API (${response.status})`);
    }

    return data;
}

function validateSteamId(steamId) {
    return /^\d{17}$/.test(steamId);
}

function getStatusLabel(status) {
    const labels = {
        pending: "En attente",
        claimed: "Réclamée",
        processing: "En traitement",
        delivered: "Livrée",
        failed: "Erreur",
        cancelled: "Annulée"
    };

    return labels[status] || status || "Inconnu";
}

function formatDate(value) {
    if (!value) return "Date inconnue";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Date inconnue";

    return new Intl.DateTimeFormat("fr-FR", {
        dateStyle: "short",
        timeStyle: "short"
    }).format(date);
}

function normalizeDeliveries(data) {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.deliveries)) return data.deliveries;
    if (Array.isArray(data?.items)) return data.items;
    return [];
}

function normalizeDeliveryItems(delivery) {
    if (Array.isArray(delivery?.items)) return delivery.items;
    if (Array.isArray(delivery?.deliveryItems)) return delivery.deliveryItems;
    return [];
}

function getFilteredDeliveries() {
    const status = elements.statusFilter?.value || "";
    const query = (elements.searchInput?.value || "").trim().toLowerCase();

    return allDeliveries.filter((delivery) => {
        if (status && delivery.status !== status) return false;
        if (!query) return true;

        const haystack = [
            delivery.title,
            delivery.playerName,
            delivery.player_name,
            delivery.steamId,
            delivery.steam_id,
            delivery.message
        ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

        return haystack.includes(query);
    });
}

function updateCounters() {
    const count = (statuses) => allDeliveries.filter((delivery) => statuses.includes(delivery.status)).length;

    if (elements.totalCount) elements.totalCount.textContent = String(allDeliveries.length);
    if (elements.pendingCount) elements.pendingCount.textContent = String(count(["pending", "claimed"]));
    if (elements.processingCount) elements.processingCount.textContent = String(count(["processing"]));
    if (elements.deliveredCount) elements.deliveredCount.textContent = String(count(["delivered"]));
}

function renderDelivery(delivery) {
    const article = document.createElement("article");
    article.className = "admin-delivery-card";
    article.dataset.deliveryId = delivery.id || "";

    const status = delivery.status || "pending";
    const items = normalizeDeliveryItems(delivery);
    const playerName = delivery.playerName || delivery.player_name || "Joueur inconnu";
    const steamId = delivery.steamId || delivery.steam_id || "SteamID inconnu";

    const itemsHtml = items.length
        ? items.map((item) => {
            const name = item.name || item.className || item.classname || "Objet";
            const quantity = Number(item.quantity || item.qty || 1);
            return `<span>${escapeHtml(name)} <b>×${quantity}</b></span>`;
        }).join("")
        : `<span>Aucun objet renseigné</span>`;

    const actions = [];
    if (["pending", "claimed"].includes(status)) {
        actions.push(`<button type="button" data-delivery-action="processing">Mettre en traitement</button>`);
    }
    if (["pending", "claimed", "processing", "failed"].includes(status)) {
        actions.push(`<button type="button" data-delivery-action="delivered" class="is-success">Marquer livrée</button>`);
    }
    if (!["delivered", "cancelled"].includes(status)) {
        actions.push(`<button type="button" data-delivery-action="cancelled">Annuler</button>`);
    }
    actions.push(`<button type="button" data-delivery-action="duplicate">Dupliquer</button>`);
    actions.push(`<button type="button" data-delivery-action="delete" class="is-danger">Supprimer</button>`);

    article.innerHTML = `
        <div class="admin-delivery-card__head">
            <div>
                <span class="admin-delivery-card__eyebrow">LIVRAISON // ${escapeHtml(String(delivery.id || "").slice(0, 8).toUpperCase())}</span>
                <h3>${escapeHtml(delivery.title || "Livraison sans titre")}</h3>
            </div>
            <span class="admin-status admin-status--${escapeHtml(status)}">${escapeHtml(getStatusLabel(status))}</span>
        </div>

        <div class="admin-delivery-card__identity">
            <strong>${escapeHtml(playerName)}</strong>
            <span>${escapeHtml(steamId)}</span>
            <time>${escapeHtml(formatDate(delivery.createdAt || delivery.created_at))}</time>
        </div>

        ${delivery.message ? `<p class="admin-delivery-card__message">${escapeHtml(delivery.message)}</p>` : ""}

        <div class="admin-delivery-card__items">
            <small>CONTENU // ${items.length} OBJET${items.length > 1 ? "S" : ""}</small>
            <div>${itemsHtml}</div>
        </div>

        <div class="admin-delivery-card__actions">
            ${actions.join("")}
        </div>
    `;

    article.addEventListener("click", (event) => {
        const button = event.target.closest("[data-delivery-action]");
        if (!button) return;
        handleDeliveryAction(delivery, button.dataset.deliveryAction, button);
    });

    return article;
}

function renderDeliveries() {
    if (!elements.list) return;

    const deliveries = getFilteredDeliveries();
    elements.list.innerHTML = "";

    if (!deliveries.length) {
        show(elements.empty);
        return;
    }

    hide(elements.empty);
    deliveries.forEach((delivery) => elements.list.appendChild(renderDelivery(delivery)));
}

async function loadDeliveries({ silent = false } = {}) {
    if (!silent) {
        show(elements.loading);
        hide(elements.empty);
        setLoading(elements.refreshButton, true);
    }

    try {
        const data = await apiRequest();
        allDeliveries = normalizeDeliveries(data);
        updateCounters();
        renderDeliveries();
    } catch (error) {
        console.error("[Senzany Admin] Chargement livraisons :", error);

        if (elements.list) {
            elements.list.innerHTML = `
                <div class="admin-list-message admin-list-message--error">
                    Impossible de charger les livraisons : ${escapeHtml(error.message || "Erreur inconnue")}
                </div>
            `;
        }
    } finally {
        hide(elements.loading);
        if (!silent) setLoading(elements.refreshButton, false);
    }
}

function resetDeliveryForm() {
    elements.form?.reset();
    clearItemRows(elements.itemsList);
    addItemRow(elements.itemsList);
}

async function handleDeliverySubmit(event) {
    event.preventDefault();
    clearFeedback(elements.feedback);

    const steamId = elements.steamId?.value.trim() || "";
    const playerName = elements.playerName?.value.trim() || "";
    const title = elements.title?.value.trim() || "";
    const message = elements.message?.value.trim() || "";
    const items = getItemsFromContainer(elements.itemsList);

    if (!validateSteamId(steamId)) {
        showFeedback(elements.feedback, "Le SteamID64 doit contenir exactement 17 chiffres.", "error");
        return;
    }

    if (!title) {
        showFeedback(elements.feedback, "Le titre de la livraison est obligatoire.", "error");
        return;
    }

    if (!items.length) {
        showFeedback(elements.feedback, "Ajoute au moins un objet à la livraison.", "error");
        return;
    }

    setLoading(elements.submitButton, true);

    try {
        await apiRequest("", {
            method: "POST",
            body: JSON.stringify({ steamId, playerName, title, message, items })
        });

        showFeedback(elements.feedback, "La livraison a bien été créée.", "success");
        resetDeliveryForm();
        await loadDeliveries({ silent: true });
    } catch (error) {
        showFeedback(elements.feedback, error.message || "Impossible de créer la livraison.", "error");
    } finally {
        setLoading(elements.submitButton, false);
    }
}

async function handleDeliveryAction(delivery, action, button) {
    if (!delivery?.id) return;

    if (action === "duplicate") {
        elements.steamId.value = delivery.steamId || delivery.steam_id || "";
        elements.playerName.value = delivery.playerName || delivery.player_name || "";
        elements.title.value = `${delivery.title || "Livraison"} (copie)`;
        elements.message.value = delivery.message || "";
        clearItemRows(elements.itemsList);

        const items = normalizeDeliveryItems(delivery);
        if (!items.length) {
            addItemRow(elements.itemsList);
        } else {
            items.forEach((item) => {
                addItemRow(elements.itemsList);
                const row = elements.itemsList.lastElementChild;
                const nameInput = row?.querySelector('input[type="text"]');
                const quantityInput = row?.querySelector('input[type="number"]');
                if (nameInput) nameInput.value = item.className || item.classname || item.name || "";
                if (quantityInput) quantityInput.value = Number(item.quantity || item.qty || 1);
            });
        }

        elements.form?.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
    }

    if (action === "delete") {
        const confirmed = window.confirm(`Supprimer définitivement la livraison « ${delivery.title || "sans titre"} » ?`);
        if (!confirmed) return;

        setLoading(button, true);
        try {
            await apiRequest(`/${encodeURIComponent(delivery.id)}`, { method: "DELETE" });
            await loadDeliveries({ silent: true });
        } catch (error) {
            window.alert(error.message || "Impossible de supprimer cette livraison.");
        } finally {
            setLoading(button, false);
        }
        return;
    }

    const labels = {
        processing: "passer cette livraison en traitement",
        delivered: "marquer cette livraison comme livrée",
        cancelled: "annuler cette livraison"
    };

    if (!window.confirm(`Confirmer : ${labels[action] || "modifier cette livraison"} ?`)) return;

    setLoading(button, true);
    try {
        await apiRequest(`/${encodeURIComponent(delivery.id)}`, {
            method: "PATCH",
            body: JSON.stringify({ status: action })
        });
        await loadDeliveries({ silent: true });
    } catch (error) {
        window.alert(error.message || "Impossible de modifier cette livraison.");
    } finally {
        setLoading(button, false);
    }
}

function scheduleAutoRefresh() {
    if (refreshTimer) window.clearInterval(refreshTimer);

    refreshTimer = window.setInterval(() => {
        const view = document.getElementById("adminDeliveriesView");
        if (view && !view.hidden && document.visibilityState === "visible") {
            loadDeliveries({ silent: true });
        }
    }, AUTO_REFRESH_MS);
}

function initializeDeliveries() {
    if (elements.itemsList && !elements.itemsList.children.length) {
        addItemRow(elements.itemsList);
    }

    elements.addItemButton?.addEventListener("click", () => addItemRow(elements.itemsList));
    elements.form?.addEventListener("submit", handleDeliverySubmit);
    elements.refreshButton?.addEventListener("click", () => loadDeliveries());
    elements.statusFilter?.addEventListener("change", renderDeliveries);
    elements.searchInput?.addEventListener("input", () => {
        window.clearTimeout(searchTimer);
        searchTimer = window.setTimeout(renderDeliveries, 120);
    });

    scheduleAutoRefresh();
}

initializeDeliveries();

export { loadDeliveries };
