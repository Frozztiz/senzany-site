import { apiRequest } from "./api.js";

const elements = {
    back: document.getElementById("backToAdminHomeFromItems"),
    file: document.getElementById("itemsZipFile"),
    importButton: document.getElementById("importItemsButton"),
    importFeedback: document.getElementById("itemsImportFeedback"),
    total: document.getElementById("itemsDatabaseTotal"),
    search: document.getElementById("itemsDatabaseSearch"),
    searchButton: document.getElementById("searchItemsButton"),
    results: document.getElementById("itemsDatabaseResults"),
    empty: document.getElementById("itemsDatabaseEmpty"),
    imageStart: document.getElementById("startItemImagesButton"),
    imageStop: document.getElementById("stopItemImagesButton"),
    imageRetry: document.getElementById("retryItemImagesButton"),
    imageFound: document.getElementById("itemImagesFound"),
    imageMissing: document.getElementById("itemImagesMissing"),
    imageErrors: document.getElementById("itemImagesErrors"),
    imagePending: document.getElementById("itemImagesPending"),
    imageProgress: document.getElementById("itemImagesProgressBar"),
    imageStatus: document.getElementById("itemImagesStatus")
};

let imageSearchRunning = false;
let stopImageSearchRequested = false;

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function normalizeItem(item = {}) {
    const className = item.className || item.classname || "";
    return {
        className,
        displayName: item.displayName || item.display_name || className,
        category: item.category || "Non classé",
        modName: item.modName || item.mod_name || "Source non identifiée",
        sourceFile: item.sourceFile || item.source_file || "",
        imageUrl: item.imageUrl || item.image_url || "",
        imageStatus: item.imageStatus || item.image_status || ""
    };
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

function updateImageStats(stats = {}) {
    const total = Number(stats.total || 0);
    const found = Number(stats.found || 0);
    const missing = Number(stats.notFound || 0);
    const errors = Number(stats.errors || 0);
    const pending = Number(stats.pending || 0);
    if (elements.imageFound) elements.imageFound.textContent = found.toLocaleString("fr-FR");
    if (elements.imageMissing) elements.imageMissing.textContent = missing.toLocaleString("fr-FR");
    if (elements.imageErrors) elements.imageErrors.textContent = errors.toLocaleString("fr-FR");
    if (elements.imagePending) elements.imagePending.textContent = pending.toLocaleString("fr-FR");
    if (elements.imageProgress) {
        const completed = Math.max(total - pending, 0);
        elements.imageProgress.style.width = `${total ? Math.min((completed / total) * 100, 100) : 0}%`;
    }
}

async function loadImageStats() {
    try {
        const stats = await apiRequest("/api/admin/items/images/stats");
        updateImageStats(stats);
        return stats;
    } catch (error) {
        if (elements.imageStatus) elements.imageStatus.textContent = "Exécute d’abord les migrations Supabase dans l’ordre indiqué dans supabase/README.md.";
        return null;
    }
}

function renderItems(rawItems) {
    if (!elements.results || !elements.empty) return;
    const items = rawItems.map(normalizeItem).filter(item => item.className);
    elements.results.innerHTML = "";
    elements.empty.hidden = items.length > 0;

    for (const item of items) {
        const card = document.createElement("article");
        card.className = "admin-item-result";
        const image = item.imageUrl
            ? `<img src="${escapeHtml(item.imageUrl)}" alt="" loading="lazy" referrerpolicy="no-referrer" />`
            : `<span class="admin-item-result__placeholder">?</span>`;
        card.innerHTML = `
            <div class="admin-item-result__image">${image}</div>
            <div class="admin-item-result__identity">
                <strong>${escapeHtml(item.className)}</strong>
                ${item.displayName !== item.className ? `<span>${escapeHtml(item.displayName)}</span>` : ""}
                ${item.sourceFile ? `<small>Source : ${escapeHtml(item.sourceFile)}</small>` : ""}
            </div>
            <div class="admin-item-result__meta">
                <span>${escapeHtml(item.category)}</span>
                <span>${escapeHtml(item.modName)}</span>
                <span>${item.imageUrl ? "Image trouvée" : (item.imageStatus === "not_found" ? "Sans image publique" : "Image à rechercher")}</span>
            </div>
            <button class="admin-button admin-button--small" type="button" data-copy="${escapeHtml(item.className)}">Copier</button>
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
        elements.empty.hidden = false;
        elements.empty.textContent = "Saisis au moins 2 caractères.";
        return;
    }

    if (elements.searchButton) elements.searchButton.disabled = true;
    try {
        const data = await apiRequest(`/api/admin/items?q=${encodeURIComponent(query)}&limit=50`);
        renderItems(Array.isArray(data.items) ? data.items : []);
        elements.empty.textContent = "Aucun objet trouvé.";
    } catch (error) {
        renderItems([]);
        elements.empty.hidden = false;
        elements.empty.textContent = error.message || "Recherche impossible.";
    } finally {
        if (elements.searchButton) elements.searchButton.disabled = false;
    }
}

async function runImageSearch({ retryMissing = false } = {}) {
    if (imageSearchRunning) return;
    imageSearchRunning = true;
    stopImageSearchRequested = false;
    elements.imageStart.disabled = true;
    elements.imageRetry.disabled = true;
    elements.imageStop.disabled = false;
    elements.imageStatus.textContent = retryMissing ? "Relance des images absentes…" : "Recherche en cours…";

    try {
        while (!stopImageSearchRequested) {
            const data = await apiRequest("/api/admin/items/images/process", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ batchSize: 20, retryMissing })
            });
            updateImageStats(data.stats);
            if (!data.processed) break;
            elements.imageStatus.textContent = `${Number(data.processed).toLocaleString("fr-FR")} objets traités dans le dernier lot…`;
        }
        elements.imageStatus.textContent = stopImageSearchRequested
            ? "Arrêt effectué. Clique à nouveau pour reprendre."
            : "Traitement terminé pour cette sélection.";
    } catch (error) {
        elements.imageStatus.textContent = error.message || "La recherche d’images a échoué.";
    } finally {
        imageSearchRunning = false;
        elements.imageStart.disabled = false;
        elements.imageRetry.disabled = false;
        elements.imageStop.disabled = true;
        await loadImageStats();
    }
}

async function retryMissingImages() {
    if (imageSearchRunning) return;
    try {
        elements.imageRetry.disabled = true;
        elements.imageStatus.textContent = "Préparation de la relance…";
        await apiRequest("/api/admin/items/images/reset", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ onlyMissing: true })
        });
        await runImageSearch();
    } catch (error) {
        elements.imageStatus.textContent = error.message || "Impossible de relancer les absentes.";
        elements.imageRetry.disabled = false;
    }
}

async function importZip() {
    const file = elements.file?.files?.[0];
    if (!file) return setFeedback("Sélectionne d’abord le ZIP contenant tes fichiers types*.xml.", "error");
    if (!/\.zip$/i.test(file.name)) return setFeedback("Le fichier sélectionné doit être une archive .zip.", "error");

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
        setFeedback(`Import terminé : ${Number(data.imported || 0).toLocaleString("fr-FR")} objets, ${data.files || 0} fichiers XML, ${Number(data.duplicates || 0).toLocaleString("fr-FR")} doublons fusionnés.`, "success");
        await Promise.all([loadStats(), loadImageStats()]);
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
    elements.imageStart?.addEventListener("click", () => runImageSearch());
    elements.imageStop?.addEventListener("click", () => { stopImageSearchRequested = true; });
    elements.imageRetry?.addEventListener("click", retryMissingImages);
    elements.search?.addEventListener("keydown", event => {
        if (event.key === "Enter") { event.preventDefault(); searchItems(); }
    });
}

export async function openCatalog() {
    await Promise.all([loadStats(), loadImageStats()]);
}
