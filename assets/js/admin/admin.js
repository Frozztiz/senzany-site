/**
 * SENZANY
 * Centre de commandement Staff
 */

import { loadDeliveries } from "./deliveries.js";
import { loadItemStats, loadItemCatalog } from "./item-catalog.js";

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
    itemsView: document.getElementById("adminItemsView"),

    deliveriesButton: document.querySelector(
        '[data-admin-module="deliveries"]'
    ),
    itemsButton: document.querySelector(
        '[data-admin-module="items"]'
    ),

    backButton: document.getElementById("backToAdminHome"),
    backFromItemsButton: document.getElementById("backToAdminHomeFromItems")
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

function hideModuleViews() {
    setHidden(elements.deliveriesView, true);
    setHidden(elements.itemsView, true);
}

function showHome() {
    hideModuleViews();
    setHidden(elements.homeView, false);
}

async function showDeliveries() {
    setHidden(elements.homeView, true);
    hideModuleViews();
    setHidden(elements.deliveriesView, false);

    await loadDeliveries();
}

async function showItems() {
    setHidden(elements.homeView, true);
    hideModuleViews();
    setHidden(elements.itemsView, false);

    await Promise.all([loadItemStats(), loadItemCatalog()]);
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
        const response = await fetch("/api/commandement/access", {
            method: "GET",
            credentials: "same-origin",
            cache: "no-store",
            headers: { Accept: "application/json" }
        });

        let access = {};
        try { access = await response.json(); } catch (_) {}

        if (response.status === 401 || access.loggedIn === false) {
            showAccessView("loggedOut");
            return;
        }

        if (response.status === 403 || access.authorized !== true) {
            showAccessView("denied");
            return;
        }

        if (!response.ok) {
            throw new Error(access.error || `Le serveur a répondu avec l’erreur ${response.status}.`);
        }

        if (elements.backendStatus) {
            elements.backendStatus.textContent = "ONLINE";
        }

        const sessionLabel = document.querySelector('.admin-status-bar strong');
        if (sessionLabel) sessionLabel.textContent = `AUTORISÉ // ${access.clearance || "ALPHA"}`;

        let profile = {};
        try {
            const profileResponse = await fetch("/api/steam/me", { credentials: "same-origin", cache: "no-store", headers: { Accept: "application/json" } });
            if (profileResponse.ok) profile = await profileResponse.json();
        } catch (_) {}

        const operatorName = profile.name || profile.personaName || access.name || access.personaName || "OPÉRATEUR SENZANY";
        const operator = document.getElementById("commandOperator");
        if (operator) operator.textContent = operatorName.toUpperCase();
        const steamIdLabel = document.getElementById("commandSteamId");
        if (steamIdLabel) steamIdLabel.textContent = `STEAMID // ${profile.steamId || access.steamId || "--"}`;
        const avatar = document.getElementById("commandAvatar");
        const avatarFallback = document.getElementById("commandAvatarFallback");
        if (avatar && profile.avatar) {
            avatar.src = profile.avatar;
            avatar.hidden = false;
            if (avatarFallback) avatarFallback.hidden = true;
        } else if (avatarFallback) {
            avatarFallback.textContent = operatorName.charAt(0).toUpperCase();
        }

        showAccessView("dashboard");
        showHome();
        runBootSequence();

    } catch (error) {
        console.error("[Senzany Commandement] Vérification impossible :", error);

        if (elements.backendStatus) elements.backendStatus.textContent = "ERREUR";
        if (elements.errorMessage) {
            elements.errorMessage.textContent = error.message || "Impossible de vérifier ta session.";
        }
        showAccessView("error");
    }
}

function startCommandClock() {
    const clock = document.getElementById("commandClock");
    if (!clock) return;
    const tick = () => { clock.textContent = new Intl.DateTimeFormat("fr-FR", {hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false}).format(new Date()); };
    tick(); setInterval(tick, 1000);
}

function runBootSequence() {
    const boot = document.getElementById("commandBoot");
    const lines = document.getElementById("commandBootLines");
    if (!boot || !lines || sessionStorage.getItem("senzany_command_boot_v3") === "done") {
        if (boot) boot.remove();
        return;
    }
    const sequence = ["SESSION STEAM ........ OK", "LIAISON DISCORD ...... OK", "BACKEND SENZANY ...... ONLINE", "AUTORISATION ALPHA ... VALIDÉE"];
    boot.classList.add("is-visible");
    sequence.forEach((text, index) => setTimeout(() => {
        const line = document.createElement("div"); line.textContent = text; lines.appendChild(line);
    }, 180 + index * 210));
    setTimeout(() => {
        boot.classList.add("is-complete");
        sessionStorage.setItem("senzany_command_boot_v3", "done");
        setTimeout(() => boot.remove(), 550);
    }, 1250);
}

function initializeAdmin() {
    startCommandClock();
    elements.deliveriesButton?.addEventListener(
        "click",
        showDeliveries
    );

    elements.itemsButton?.addEventListener(
        "click",
        () => showItems().catch((error) => console.error("[Senzany Items]", error))
    );

    elements.backButton?.addEventListener(
        "click",
        showHome
    );

    elements.backFromItemsButton?.addEventListener(
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