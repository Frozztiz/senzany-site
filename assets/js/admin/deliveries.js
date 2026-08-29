/**
 * SENZANY
 * Gestion complète du module Livraisons
 */

import {
    getDeliveries,
    createDelivery
} from "./api.js";

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

const isLocalDev = ["localhost", "127.0.0.1"].includes(window.location.hostname);
const localApiBaseUrl = "http://127.0.0.1:3000";

function adminApiUrl(path) {
    return isLocalDev ? `${localApiBaseUrl}${path}` : path;
}

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
    refreshButton: document.getElementById("refreshDeliveriesButton"),

    loading: document.getElementById("deliveriesLoading"),
    empty: document.getElementById("deliveriesEmpty"),
    list: document.getElementById("deliveriesList")
};


let registeredPlayers = [];

function createRegisteredPlayerPicker() {
    if (!elements.steamId || document.getElementById("deliveryRegisteredPlayer")) {
        return;
    }

    const wrapper = document.createElement("div");
    wrapper.className = "admin-field";
    wrapper.innerHTML = `
        <label for="deliveryRegisteredPlayer">Joueur enregistré</label>
        <select id="deliveryRegisteredPlayer" aria-label="Choisir un joueur enregistré">
            <option value="">Chargement des joueurs…</option>
        </select>
        <small>Sélectionne un joueur pour remplir automatiquement son SteamID64 et son nom.</small>
    `;

    const steamField = elements.steamId.closest(".admin-field");
    steamField?.parentNode?.insertBefore(wrapper, steamField);

    elements.playerPicker = wrapper.querySelector("#deliveryRegisteredPlayer");

    elements.playerPicker?.addEventListener("change", () => {
        const steamId = elements.playerPicker.value;
        const player = registeredPlayers.find((entry) => entry.steamId === steamId);

        if (!player) return;

        elements.steamId.value = player.steamId;
        if (elements.playerName && player.playerName) {
            elements.playerName.value = player.playerName;
        }
    });
}

function renderRegisteredPlayers() {
    if (!elements.playerPicker) return;

    const options = registeredPlayers.map((player) => {
        const label = player.playerName
            ? `${player.playerName} — ${player.steamId}`
            : player.steamId;

        return `<option value="${escapeHtml(player.steamId)}">${escapeHtml(label)}</option>`;
    });

    elements.playerPicker.innerHTML = [
        '<option value="">— Choisir un joueur enregistré —</option>',
        ...options
    ].join("");
}

async function loadRegisteredPlayers() {
    createRegisteredPlayerPicker();
    if (!elements.playerPicker) return;

    elements.playerPicker.disabled = true;
    elements.playerPicker.innerHTML = '<option value="">Chargement des joueurs…</option>';

    try {
        const response = await fetch(adminApiUrl("/api/admin/deliveries/players"), {
            method: "GET",
            credentials: isLocalDev ? "omit" : "same-origin",
            cache: "no-store",
            headers: { Accept: "application/json" }
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(data.error || `Erreur ${response.status}`);
        }

        registeredPlayers = Array.isArray(data.players) ? data.players : [];
        renderRegisteredPlayers();
    } catch (error) {
        console.error("[Senzany Admin] Erreur chargement joueurs enregistrés :", error);
        elements.playerPicker.innerHTML = '<option value="">Joueurs indisponibles</option>';
    } finally {
        elements.playerPicker.disabled = false;
    }
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
    if (!value) {
        return "Date inconnue";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "Date inconnue";
    }

    return new Intl.DateTimeFormat("fr-FR", {
        dateStyle: "medium",
        timeStyle: "short"
    }).format(date);
}

function normalizeDeliveries(data) {
    if (Array.isArray(data)) {
        return data;
    }

    if (Array.isArray(data?.deliveries)) {
        return data.deliveries;
    }

    if (Array.isArray(data?.items)) {
        return data.items;
    }

    return [];
}

function normalizeDeliveryItems(delivery) {
    if (Array.isArray(delivery?.items)) {
        return delivery.items;
    }

    if (Array.isArray(delivery?.deliveryItems)) {
        return delivery.deliveryItems;
    }

    return [];
}

function renderDelivery(delivery) {
    const article = document.createElement("article");
    article.className = "admin-delivery";

    const items = normalizeDeliveryItems(delivery);

    const itemsHtml = items.length
        ? items.map(item => {
            const itemName =
                item.name ||
                item.className ||
                item.classname ||
                "Objet";

            const quantity =
                Number(item.quantity) ||
                Number(item.qty) ||
                1;

            return `
                <span class="admin-delivery__item">
                    ${escapeHtml(itemName)} × ${quantity}
                </span>
            `;
        }).join("")
        : `
            <span class="admin-delivery__item">
                Aucun objet renseigné
            </span>
        `;

    const status = delivery.status || "pending";

    article.innerHTML = `
        <div class="admin-delivery__top">
            <div>
                <h3>
                    ${escapeHtml(
                        delivery.title ||
                        "Livraison sans titre"
                    )}
                </h3>

                <div class="admin-delivery__meta">
                    ${escapeHtml(
                        delivery.playerName ||
                        delivery.player_name ||
                        "Joueur inconnu"
                    )}
                    ·
                    ${escapeHtml(
                        delivery.steamId ||
                        delivery.steam_id ||
                        "SteamID inconnu"
                    )}
                    ·
                    ${formatDate(
                        delivery.createdAt ||
                        delivery.created_at
                    )}
                </div>
            </div>

            <span class="admin-status admin-status--${escapeHtml(status)}">
                ${escapeHtml(getStatusLabel(status))}
            </span>
        </div>

        ${
            delivery.message
                ? `
                    <p class="admin-delivery__message">
                        ${escapeHtml(delivery.message)}
                    </p>
                `
                : ""
        }

        <div class="admin-delivery__items">
            ${itemsHtml}
        </div>
    `;

    return article;
}

function renderDeliveries(deliveries) {
    if (!elements.list) {
        return;
    }

    elements.list.innerHTML = "";

    if (!deliveries.length) {
        show(elements.empty);
        return;
    }

    hide(elements.empty);

    deliveries.forEach(delivery => {
        elements.list.appendChild(
            renderDelivery(delivery)
        );
    });
}

async function loadDeliveries() {
    show(elements.loading);
    hide(elements.empty);

    if (elements.list) {
        elements.list.innerHTML = "";
    }

    setLoading(elements.refreshButton, true);

    try {
        const status = elements.statusFilter?.value || "";

        const data = await getDeliveries(status);

        const deliveries = normalizeDeliveries(data);

        hide(elements.loading);

        renderDeliveries(deliveries);

    } catch (error) {
        console.error(
            "[Senzany Admin] Erreur chargement livraisons :",
            error
        );

        hide(elements.loading);

        if (elements.list) {
            elements.list.innerHTML = `
                <div class="admin-list-message">
                    Impossible de charger les livraisons :
                    ${escapeHtml(
                        error.message ||
                        "Erreur inconnue"
                    )}
                </div>
            `;
        }

    } finally {
        setLoading(elements.refreshButton, false);
    }
}

function resetDeliveryForm() {
    elements.form?.reset();

    if (elements.playerPicker) {
        elements.playerPicker.value = "";
    }

    clearItemRows(elements.itemsList);
}

async function handleDeliverySubmit(event) {
    event.preventDefault();

    clearFeedback(elements.feedback);

    const steamId =
        elements.steamId?.value.trim() || "";

    const playerName =
        elements.playerName?.value.trim() || "";

    const title =
        elements.title?.value.trim() || "";

    const message =
        elements.message?.value.trim() || "";

    const items =
        getItemsFromContainer(elements.itemsList);

    if (!validateSteamId(steamId)) {
        showFeedback(
            elements.feedback,
            "Le SteamID64 doit contenir exactement 17 chiffres.",
            "error"
        );

        return;
    }

    if (!title) {
        showFeedback(
            elements.feedback,
            "Le titre de la livraison est obligatoire.",
            "error"
        );

        return;
    }

    if (!items.length) {
        showFeedback(
            elements.feedback,
            "Ajoute au moins un objet à la livraison.",
            "error"
        );

        return;
    }

    const payload = {
        steamId,
        playerName,
        title,
        message,
        items
    };

    setLoading(elements.submitButton, true);

    try {
        await createDelivery(payload);

        showFeedback(
            elements.feedback,
            "La livraison a bien été créée.",
            "success"
        );

        resetDeliveryForm();

        await loadDeliveries();

    } catch (error) {
        console.error(
            "[Senzany Admin] Erreur création livraison :",
            error
        );

        showFeedback(
            elements.feedback,
            error.message ||
            "Impossible de créer la livraison.",
            "error"
        );

    } finally {
        setLoading(elements.submitButton, false);
    }
}

function initializeDeliveries() {
    loadRegisteredPlayers();
    if (
        elements.itemsList &&
        !elements.itemsList.children.length
    ) {
        addItemRow(elements.itemsList);
    }

    elements.addItemButton?.addEventListener(
        "click",
        () => addItemRow(elements.itemsList)
    );

    elements.form?.addEventListener(
        "submit",
        handleDeliverySubmit
    );

    elements.refreshButton?.addEventListener(
        "click",
        loadDeliveries
    );

    elements.statusFilter?.addEventListener(
        "change",
        loadDeliveries
    );
}

initializeDeliveries();

export {
    loadDeliveries
};