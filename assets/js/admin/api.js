/**
 * SENZANY — API du centre de commandement
 * Fichier : assets/js/admin/api.js
 */

const isLocalDevHost =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";
const localApiBaseUrl = "http://127.0.0.1:3000";

export async function apiRequest(url, options = {}) {
    const targetUrl = isLocalDevHost ? `${localApiBaseUrl}${url}` : url;
    const response = await fetch(targetUrl, {
        method: options.method || "GET",
        credentials: isLocalDevHost ? "omit" : "same-origin",
        cache: "no-store",
        signal: options.signal,
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            ...(options.headers || {})
        },
        body: options.body
            ? JSON.stringify(options.body)
            : undefined
    });

    let data = null;

    try {
        data = await response.json();
    } catch {
        data = null;
    }

    if (!response.ok) {
        const message =
            data?.message ||
            data?.error ||
            `Erreur serveur ${response.status}`;

        throw new Error(message);
    }

    return data;
}

export async function getSteamSession() {
    return apiRequest("/api/steam/me");
}

export async function getDeliveries(status = "") {
    const query = status
        ? `?status=${encodeURIComponent(status)}`
        : "";

    return apiRequest(`/api/admin/deliveries${query}`);
}

export async function createDelivery(payload) {
    return apiRequest("/api/admin/deliveries", {
        method: "POST",
        body: payload
    });
}

export async function refreshDeliveries(status = "") {
    return getDeliveries(status);
}