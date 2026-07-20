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