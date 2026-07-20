/**
 * SENZANY — API du centre de commandement
 * Fichier : assets/js/admin/api.js
 */

async function request(url, options = {}) {
    const response = await fetch(url, {
        method: options.method || "GET",
        credentials: "same-origin",
        cache: "no-store",
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
    return request("/api/steam/me");
}

export async function getDeliveries(status = "") {
    const query = status
        ? `?status=${encodeURIComponent(status)}`
        : "";

    return request(`/api/admin/deliveries${query}`);
}

export async function createDelivery(payload) {
    return request("/api/admin/deliveries", {
        method: "POST",
        body: payload
    });
}

export async function refreshDeliveries(status = "") {
    return getDeliveries(status);
}