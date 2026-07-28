import { apiRequest } from "./api.js";

const elements = {
    view: document.getElementById("adminItemsView"),
    back: document.getElementById("backToAdminHomeFromItems"),
    file: document.getElementById("itemsZipFile"),
    importButton: document.getElementById("importItemsButton"),
    importFeedback: document.getElementById("itemsImportFeedback"),
    total: document.getElementById("itemsDatabaseTotal"),
    search: document.getElementById("itemsDatabaseSearch"),
    searchButton: document.getElementById("searchItemsButton"),
    results: document.getElementById("itemsDatabaseResults"),
    empty: document.getElementById("itemsDatabaseEmpty")
};

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function setFeedback(message, type = "info") {
    if (!elements.importFeedback) return;
    elements.importFeedback.hidden = false;
    elements.importFeedback.dataset.type = type;
    elements.importFeedback.textContent = message;
}

async function loadStats() {
    try {
        const data = await apiRequest("/api/admin/items/stats");
        if (elements.total) elements.total.textContent = Number(data.total || 0).toLocaleString("fr-FR");
    } catch (_) {
        if (elements.total) elements.total.textContent = "--";
    }
}

function renderItems(items) {
    if (!elements.results || !elements.empty) return;
    elements.results.innerHTML = "";
    elements.empty.hidden = items.length > 0;

    for (const item of items) {
        const card = document.createElement("article");
        card.className = "admin-item-result";
        card.innerHTML = `
            <div>
                <strong>${escapeHtml(item.display_name || item.classname)}</strong>
                <code>${escapeHtml(item.classname)}</code>
            </div>
            <div class="admin-item-result__meta">
                <span>${escapeHtml(item.category || "Autres")}</span>
                <span>${escapeHtml(item.mod_name || "Inconnu")}</span>
            </div>
            <button class="admin-button admin-button--small" type="button" data-copy="${escapeHtml(item.classname)}">Copier</button>
        `;
        elements.results.appendChild(card);
    }

    elements.results.querySelectorAll("[data-copy]").forEach(button => {
        button.addEventListener("click", async () => {
            await navigator.clipboard.writeText(button.dataset.copy || "");
            const original = button.textContent;
            button.textContent = "Copié";
            setTimeout(() => { button.textContent = original; }, 1200);
        });
    });
}

async function searchItems() {
    const query = elements.search?.value.trim() || "";
    if (query.length < 2) {
        renderItems([]);
        if (elements.empty) {
            elements.empty.hidden = false;
            elements.empty.textContent = "Saisis au moins 2 caractères.";
        }
        return;
    }

    if (elements.searchButton) elements.searchButton.disabled = true;
    try {
        const data = await apiRequest(`/api/admin/items?q=${encodeURIComponent(query)}&limit=50`);
        renderItems(Array.isArray(data.items) ? data.items : []);
        if (elements.empty) elements.empty.textContent = "Aucun objet trouvé.";
    } catch (error) {
        renderItems([]);
        if (elements.empty) {
            elements.empty.hidden = false;
            elements.empty.textContent = error.message || "Recherche impossible.";
        }
    } finally {
        if (elements.searchButton) elements.searchButton.disabled = false;
    }
}

async function importZip() {
    const file = elements.file?.files?.[0];
    if (!file) {
        setFeedback("Sélectionne d’abord le ZIP contenant tes fichiers types*.xml.", "error");
        return;
    }
    if (!/\.zip$/i.test(file.name)) {
        setFeedback("Le fichier sélectionné doit être une archive .zip.", "error");
        return;
    }

    elements.importButton.disabled = true;
    setFeedback("Import en cours… Le backend analyse les XML et remplit Supabase.");

    try {
        const response = await fetch("/api/admin/items/import", {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/zip", Accept: "application/json" },
            body: file
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || `Erreur ${response.status}`);

        setFeedback(
            `Import terminé : ${Number(data.imported || 0).toLocaleString("fr-FR")} objets, ${data.files || 0} fichiers XML, ${Number(data.duplicates || 0).toLocaleString("fr-FR")} doublons fusionnés.`,
            "success"
        );
        await loadStats();
    } catch (error) {
        setFeedback(error.message || "L’import a échoué.", "error");
    } finally {
        elements.importButton.disabled = false;
    }
}

export function initializeCatalog({ onBack } = {}) {
    elements.back?.addEventListener("click", onBack);
    elements.importButton?.addEventListener("click", importZip);
    elements.searchButton?.addEventListener("click", searchItems);
    elements.search?.addEventListener("keydown", event => {
        if (event.key === "Enter") {
            event.preventDefault();
            searchItems();
        }
    });
}

export async function openCatalog() {
    await loadStats();
}
