/**
 * SENZANY
 * Centre de commandement Staff
 */

import { loadDeliveries } from "./deliveries.js";

const elements = {
    loading: document.getElementById("adminLoading"),
    loggedOut: document.getElementById("adminLoggedOut"),
    accessDenied: document.getElementById("adminAccessDenied"),
    error: document.getElementById("adminError"),
    errorMessage: document.getElementById("adminErrorMessage"),
    retryButton: document.getElementById("adminRetryButton"),
    dashboard: document.getElementById("adminDashboard"),

    backendStatus: document.getElementById("adminBackendStatus"),

    homeView: document.getElementById("adminHomeView"),
    deliveriesView: document.getElementById("adminDeliveriesView"),

    deliveriesButton: document.querySelector(
        '[data-admin-module="deliveries"]'
    ),

    backButton: document.getElementById("backToAdminHome")
};

function setHidden(element, hidden) {
    if (element) {
        element.hidden = hidden;
    }
}

function hideAllAccessViews() {
    setHidden(elements.loading, true);
    setHidden(elements.loggedOut, true);
    setHidden(elements.accessDenied, true);
    setHidden(elements.error, true);
    setHidden(elements.dashboard, true);
}

function showAccessView(view) {
    hideAllAccessViews();

    if (view === "loading") {
        setHidden(elements.loading, false);
    }

    if (view === "loggedOut") {
        setHidden(elements.loggedOut, false);
    }

    if (view === "denied") {
        setHidden(elements.accessDenied, false);
    }

    if (view === "error") {
        setHidden(elements.error, false);
    }

    if (view === "dashboard") {
        setHidden(elements.dashboard, false);
    }
}

function showHome() {
    setHidden(elements.homeView, false);
    setHidden(elements.deliveriesView, true);
}

async function showDeliveries() {
    setHidden(elements.homeView, true);
    setHidden(elements.deliveriesView, false);

    await loadDeliveries();
}

function isLoggedIn(user) {
    return Boolean(
        user?.loggedIn === true ||
        user?.logged === true ||
        user?.authenticated === true
    );
}

function isStaff(user) {
    return Boolean(
        user?.isStaff === true ||
        user?.staff === true ||
        user?.isAdmin === true ||
        user?.admin === true ||
        user?.role === "staff" ||
        user?.role === "admin"
    );
}

async function checkAccess() {
    showAccessView("loading");

    if (elements.backendStatus) {
        elements.backendStatus.textContent = "CONNEXION...";
    }

    try {
        const response = await fetch("/api/steam/me", {
            method: "GET",
            credentials: "same-origin",
            cache: "no-store",
            headers: {
                Accept: "application/json"
            }
        });

        if (!response.ok) {
            throw new Error(
                `Le serveur a répondu avec l’erreur ${response.status}.`
            );
        }

        const user = await response.json();

        console.log("[Senzany Admin] Session Steam :", user);

        if (!isLoggedIn(user)) {
            showAccessView("loggedOut");
            return;
        }

        if (!isStaff(user)) {
            showAccessView("denied");
            return;
        }

        if (elements.backendStatus) {
            elements.backendStatus.textContent = "ONLINE";
        }

        showAccessView("dashboard");
        showHome();

    } catch (error) {
        console.error(
            "[Senzany Admin] Impossible de vérifier l’accès :",
            error
        );

        if (elements.backendStatus) {
            elements.backendStatus.textContent = "ERREUR";
        }

        if (elements.errorMessage) {
            elements.errorMessage.textContent =
                error.message ||
                "Impossible de vérifier ta session.";
        }

        showAccessView("error");
    }
}

function initializeAdmin() {
    elements.deliveriesButton?.addEventListener(
        "click",
        showDeliveries
    );

    elements.backButton?.addEventListener(
        "click",
        showHome
    );

    elements.retryButton?.addEventListener(
        "click",
        checkAccess
    );

    checkAccess();
}

if (document.readyState === "loading") {
    document.addEventListener(
        "DOMContentLoaded",
        initializeAdmin,
        { once: true }
    );
} else {
    initializeAdmin();
}