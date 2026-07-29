import { apiRequest } from "./api.js";

const elements = {
    back: document.getElementById("backToAdminHomeFromItems"),
    file: document.getElementById("itemsZipFile"),
    importButton: document.getElementById("importItemsButton"),
    importFeedback: document.getElementById("itemsImportFeedback"),
    total: document.getElementById("itemsDatabaseTotal"),
    deliveryTotal: document.getElementById("itemsDeliveryTotal"),
    shopTotal: document.getElementById("itemsShopTotal"),
    battlePassTotal: document.getElementById("itemsBattlePassTotal"),
    rewardTotal: document.getElementById("itemsRewardTotal"),
    search: document.getElementById("itemsDatabaseSearch"),
    modFilter: document.getElementById("itemsModFilter"),
    categoryFilter: document.getElementById("itemsCategoryFilter"),
    availabilityFilter: document.getElementById("itemsAvailabilityFilter"),
    imageFilter: document.getElementById("itemsImageFilter"),
    classifyButton: document.getElementById("classifyItemsButton"),
    classificationStatus: document.getElementById("itemClassificationStatus"),
    searchButton: document.getElementById("searchItemsButton"),
    resetButton: document.getElementById("resetItemsFiltersButton"),
    results: document.getElementById("itemsDatabaseResults"),
    empty: document.getElementById("itemsDatabaseEmpty"),
    count: document.getElementById("itemsResultsCount"),
    previous: document.getElementById("itemsPreviousPage"),
    next: document.getElementById("itemsNextPage"),
    page: document.getElementById("itemsPageLabel"),
    editor: document.getElementById("itemEditorDialog"),
    editorForm: document.getElementById("itemEditorForm"),
    editorClose: document.getElementById("closeItemEditor"),
    editorCancel: document.getElementById("cancelItemEditor"),
    editorFeedback: document.getElementById("itemEditorFeedback"),
    editorClassname: document.getElementById("itemEditorClassname"),
    editorDisplayName: document.getElementById("itemEditorDisplayName"),
    editorCategory: document.getElementById("itemEditorCategory"),
    editorSubcategory: document.getElementById("itemEditorSubcategory"),
    editorModName: document.getElementById("itemEditorModName"),
    editorImageUrl: document.getElementById("itemEditorImageUrl"),
    editorImagePreview: document.getElementById("itemEditorImagePreview"),
    editorActive: document.getElementById("itemEditorActive"),
    editorDelivery: document.getElementById("itemEditorDelivery"),
    editorShop: document.getElementById("itemEditorShop"),
    editorBattlePass: document.getElementById("itemEditorBattlePass"),
    editorReward: document.getElementById("itemEditorReward"),
    editorSave: document.getElementById("saveItemEditor"),
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

const state = {
    items: [],
    selectedItem: null,
    total: 0,
    limit: 40,
    offset: 0,
    loading: false,
    categories: [],
    subcategories: {}
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
        id: item.id || "",
        className,
        displayName: item.displayName || item.display_name || className,
        category: item.category || "Non classé",
        subcategory: item.subcategory || "",
        modName: item.modName || item.mod_name || "Source non identifiée",
        sourceFile: item.sourceFile || item.source_file || "",
        sourcePath: item.sourcePath || item.source_path || "",
        active: item.active !== false && item.is_active !== false,
        deliveryEnabled: item.deliveryEnabled !== false && item.delivery_enabled !== false,
        shopEnabled: item.shopEnabled === true || item.shop_enabled === true,
        battlePassEnabled: item.battlePassEnabled === true || item.battle_pass_enabled === true,
        rewardEnabled: item.rewardEnabled !== false && item.reward_enabled !== false,
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

function setEditorFeedback(message = "", type = "info") {
    if (!elements.editorFeedback) return;
    elements.editorFeedback.hidden = !message;
    elements.editorFeedback.dataset.type = type;
    elements.editorFeedback.textContent = message;
}

function populateSelect(select, values, placeholder) {
    if (!select) return;
    const current = select.value;
    select.innerHTML = `<option value="">${escapeHtml(placeholder)}</option>`;
    for (const value of values || []) {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = value;
        select.appendChild(option);
    }
    select.value = [...select.options].some(option => option.value === current) ? current : "";
}

function populateEditorCategory(selectedValue = "") {
    if (!elements.editorCategory) return;
    const categories = [...state.categories];
    const safeSelected = String(selectedValue || "").trim();
    if (safeSelected && !categories.includes(safeSelected)) categories.push(safeSelected);
    categories.sort((a, b) => a.localeCompare(b, "fr"));

    elements.editorCategory.innerHTML = "";
    for (const category of categories) {
        const option = document.createElement("option");
        option.value = category;
        option.textContent = category;
        elements.editorCategory.appendChild(option);
    }
    elements.editorCategory.value = safeSelected || categories[0] || "Autre";
}

function populateEditorSubcategory(category, selectedValue = "") {
    if (!elements.editorSubcategory) return;
    const values = [...(state.subcategories?.[category] || [])];
    const safeSelected = String(selectedValue || "").trim();
    if (safeSelected && !values.includes(safeSelected)) values.push(safeSelected);
    values.sort((a, b) => a.localeCompare(b, "fr"));

    elements.editorSubcategory.innerHTML = '<option value="">Sans sous-catégorie</option>';
    for (const value of values) {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = value;
        elements.editorSubcategory.appendChild(option);
    }
    elements.editorSubcategory.value = safeSelected;
}

async function loadStats() {
    try {
        const data = await apiRequest("/api/admin/items/stats");
        elements.total.textContent = Number(data.total || 0).toLocaleString("fr-FR");
        if (elements.deliveryTotal) elements.deliveryTotal.textContent = Number(data.availability?.delivery || 0).toLocaleString("fr-FR");
        if (elements.shopTotal) elements.shopTotal.textContent = Number(data.availability?.shop || 0).toLocaleString("fr-FR");
        if (elements.battlePassTotal) elements.battlePassTotal.textContent = Number(data.availability?.battlePass || 0).toLocaleString("fr-FR");
        if (elements.rewardTotal) elements.rewardTotal.textContent = Number(data.availability?.reward || 0).toLocaleString("fr-FR");
        state.categories = Array.isArray(data.categories) ? data.categories : [];
        state.subcategories = data.subcategories && typeof data.subcategories === "object"
            ? data.subcategories
            : {};
        populateSelect(elements.modFilter, data.mods, "Tous les mods");
        populateSelect(elements.categoryFilter, state.categories, "Toutes les catégories");
    } catch (_) {
        if (elements.total) elements.total.textContent = "--";
    }
}

function availabilityBadge(label, active) {
    return `<span class="catalog-badge ${active ? "is-enabled" : "is-disabled"}">${escapeHtml(label)}</span>`;
}

function renderItems(rawItems) {
    if (!elements.results || !elements.empty) return;
    const items = rawItems.map(normalizeItem).filter(item => item.className);
    state.items = items;
    elements.results.innerHTML = "";
    elements.empty.hidden = items.length > 0;

    items.forEach((item, itemIndex) => {
        const card = document.createElement("article");
        card.className = "admin-item-result admin-item-result--manager";
        card.dataset.itemId = item.id;
        const image = item.imageUrl
            ? `<img src="${escapeHtml(item.imageUrl)}" alt="" loading="lazy" referrerpolicy="no-referrer" />`
            : `<span class="admin-item-result__placeholder">?</span>`;

        card.innerHTML = `
            <div class="admin-item-result__image">${image}</div>
            <div class="admin-item-result__identity">
                <strong>${escapeHtml(item.className)}</strong>
                <span>${escapeHtml(item.displayName)}</span>
                <small>${escapeHtml(item.modName)}${item.sourceFile ? ` // ${escapeHtml(item.sourceFile)}` : ""}</small>
            </div>
            <div class="admin-item-result__classification">
                <span>${escapeHtml(item.category)}</span>
                <small>${escapeHtml(item.subcategory || "Sans sous-catégorie")}</small>
            </div>
            <div class="admin-item-result__availability">
                ${availabilityBadge("Livraison", item.deliveryEnabled)}
                ${availabilityBadge("Boutique", item.shopEnabled)}
                ${availabilityBadge("Battle Pass", item.battlePassEnabled)}
                ${availabilityBadge("Récompense", item.rewardEnabled)}
            </div>
            <div class="admin-item-result__actions">
                <button class="admin-button admin-button--small" type="button" data-edit-index="${itemIndex}">Modifier</button>
                <button class="admin-button admin-button--small" type="button" data-copy="${escapeHtml(item.className)}">Copier</button>
            </div>
        `;
        elements.results.appendChild(card);
    });

    elements.results.querySelectorAll("[data-edit-index]").forEach(button => {
        button.addEventListener("click", () => {
            const itemIndex = Number(button.dataset.editIndex);
            const item = Number.isInteger(itemIndex) ? state.items[itemIndex] : null;

            if (!item) {
                console.error("[Senzany Catalogue] Objet introuvable pour l’édition.", {
                    itemIndex,
                    availableItems: state.items.length
                });
                return;
            }

            openEditor(item);
        });
    });

    elements.results.querySelectorAll("[data-copy]").forEach(button => {
        button.addEventListener("click", async () => {
            const value = button.dataset.copy || "";
            const original = button.textContent;

            try {
                if (navigator.clipboard?.writeText) {
                    await navigator.clipboard.writeText(value);
                } else {
                    const textarea = document.createElement("textarea");
                    textarea.value = value;
                    textarea.setAttribute("readonly", "");
                    textarea.style.position = "fixed";
                    textarea.style.opacity = "0";
                    textarea.style.pointerEvents = "none";
                    document.body.appendChild(textarea);
                    textarea.select();
                    const copied = document.execCommand("copy");
                    textarea.remove();
                    if (!copied) throw new Error("La copie a été refusée par le navigateur.");
                }

                button.textContent = "Copié";
            } catch (error) {
                console.error("[Senzany Catalogue] Copie impossible :", error);
                button.textContent = "Échec";
            }

            setTimeout(() => { button.textContent = original; }, 1200);
        });
    });
}

function renderPagination() {
    const first = state.total ? state.offset + 1 : 0;
    const last = Math.min(state.offset + state.limit, state.total);
    const currentPage = Math.floor(state.offset / state.limit) + 1;
    const totalPages = Math.max(Math.ceil(state.total / state.limit), 1);

    if (elements.count) elements.count.textContent = `${first.toLocaleString("fr-FR")}–${last.toLocaleString("fr-FR")} sur ${state.total.toLocaleString("fr-FR")}`;
    if (elements.page) elements.page.textContent = `Page ${currentPage} / ${totalPages}`;
    if (elements.previous) elements.previous.disabled = state.offset <= 0 || state.loading;
    if (elements.next) elements.next.disabled = state.offset + state.limit >= state.total || state.loading;
}

function getSearchParams() {
    const params = new URLSearchParams({
        limit: String(state.limit),
        offset: String(state.offset)
    });
    const query = elements.search?.value.trim();
    if (query) params.set("q", query);
    if (elements.modFilter?.value) params.set("mod", elements.modFilter.value);
    if (elements.categoryFilter?.value) params.set("category", elements.categoryFilter.value);
    if (elements.availabilityFilter?.value) params.set("availability", elements.availabilityFilter.value);
    if (elements.imageFilter?.value) params.set("imageStatus", elements.imageFilter.value);
    return params;
}

async function searchItems({ resetPage = false } = {}) {
    if (resetPage) state.offset = 0;
    state.loading = true;
    renderPagination();
    if (elements.searchButton) elements.searchButton.disabled = true;
    elements.empty.hidden = false;
    elements.empty.textContent = "Chargement du catalogue…";

    try {
        const data = await apiRequest(`/api/admin/items?${getSearchParams().toString()}`);
        state.total = Number(data.total || 0);
        state.offset = Number(data.offset || state.offset);
        renderItems(Array.isArray(data.items) ? data.items : []);
        elements.empty.textContent = "Aucun objet ne correspond aux filtres.";
    } catch (error) {
        state.total = 0;
        renderItems([]);
        elements.empty.hidden = false;
        elements.empty.textContent = error.message || "Recherche impossible.";
    } finally {
        state.loading = false;
        if (elements.searchButton) elements.searchButton.disabled = false;
        renderPagination();
    }
}

function updateEditorImagePreview(url = "") {
    if (!elements.editorImagePreview) return;
    const safeUrl = String(url || "").trim();
    elements.editorImagePreview.innerHTML = "";

    if (!safeUrl) {
        elements.editorImagePreview.innerHTML = "<span>Aucune image</span>";
        return;
    }

    const image = document.createElement("img");
    image.src = safeUrl;
    image.alt = "Aperçu de l'objet";
    image.loading = "lazy";
    image.referrerPolicy = "no-referrer";
    image.addEventListener("error", () => {
        elements.editorImagePreview.innerHTML = "<span>Image inaccessible</span>";
    });
    elements.editorImagePreview.appendChild(image);
}

async function classifyItems() {
    if (!elements.classifyButton) return;
    elements.classifyButton.disabled = true;
    if (elements.classificationStatus) elements.classificationStatus.textContent = "Classement en cours…";

    let totalUpdated = 0;
    let totalProcessed = 0;

    try {
        for (let batch = 0; batch < 50; batch += 1) {
            const data = await apiRequest("/api/admin/items/classify", {
                method: "POST",
                body: { batchSize: 250 }
            });

            totalUpdated += Number(data.updated || 0);
            totalProcessed += Number(data.processed || 0);

            if (elements.classificationStatus) {
                elements.classificationStatus.textContent = `${totalUpdated.toLocaleString("fr-FR")} objet(s) classé(s)…`;
            }

            if (!data.processed || !data.updated) break;
        }

        if (elements.classificationStatus) {
            elements.classificationStatus.textContent = `${totalUpdated.toLocaleString("fr-FR")} objet(s) classé(s) automatiquement.`;
        }
        await Promise.all([loadStats(), searchItems({ resetPage: true })]);
    } catch (error) {
        if (elements.classificationStatus) {
            elements.classificationStatus.textContent = error.message || "Le classement automatique a échoué.";
        }
    } finally {
        elements.classifyButton.disabled = false;
    }
}

function openEditor(item) {
    if (!elements.editor || typeof elements.editor.showModal !== "function") {
        console.error("[Senzany Catalogue] La fenêtre d’édition est introuvable ou invalide.");
        return;
    }

    state.selectedItem = item;
    elements.editorClassname.textContent = item.className;
    elements.editorDisplayName.value = item.displayName || "";
    populateEditorCategory(item.category || "Autre");
    populateEditorSubcategory(elements.editorCategory.value, item.subcategory || "");
    elements.editorModName.value = item.modName || "Inconnu";
    elements.editorImageUrl.value = item.imageUrl || "";
    updateEditorImagePreview(item.imageUrl || "");
    elements.editorActive.checked = item.active;
    elements.editorDelivery.checked = item.deliveryEnabled;
    elements.editorShop.checked = item.shopEnabled;
    elements.editorBattlePass.checked = item.battlePassEnabled;
    elements.editorReward.checked = item.rewardEnabled;
    setEditorFeedback();

    if (!elements.editor.open) elements.editor.showModal();
    elements.editor.classList.add("is-open");

    // Sécurité contre une ancienne règle CSS qui masquerait encore le dialogue.
    if (getComputedStyle(elements.editor).display === "none") {
        elements.editor.style.display = "block";
    }
}

function closeEditor() {
    if (elements.editor?.open) elements.editor.close();
    elements.editor?.classList.remove("is-open");
    if (elements.editor) elements.editor.style.removeProperty("display");
    state.selectedItem = null;
    setEditorFeedback();
}

async function saveEditor(event) {
    event.preventDefault();
    if (!state.selectedItem?.id) return;

    elements.editorSave.disabled = true;
    setEditorFeedback("Enregistrement en cours…");

    try {
        const data = await apiRequest(`/api/admin/items/${encodeURIComponent(state.selectedItem.id)}`, {
            method: "PATCH",
            body: {
                displayName: elements.editorDisplayName.value,
                category: elements.editorCategory.value,
                subcategory: elements.editorSubcategory.value,
                modName: elements.editorModName.value,
                imageUrl: elements.editorImageUrl.value,
                active: elements.editorActive.checked,
                deliveryEnabled: elements.editorDelivery.checked,
                shopEnabled: elements.editorShop.checked,
                battlePassEnabled: elements.editorBattlePass.checked,
                rewardEnabled: elements.editorReward.checked
            }
        });

        const updated = normalizeItem(data.item);
        state.items = state.items.map(item => item.id === updated.id ? updated : item);
        renderItems(state.items);
        setEditorFeedback("Objet enregistré.", "success");
        await loadStats();
        setTimeout(closeEditor, 650);
    } catch (error) {
        setEditorFeedback(error.message || "Impossible d'enregistrer l'objet.", "error");
    } finally {
        elements.editorSave.disabled = false;
    }
}

function resetFilters() {
    elements.search.value = "";
    elements.modFilter.value = "";
    elements.categoryFilter.value = "";
    elements.availabilityFilter.value = "";
    if (elements.imageFilter) elements.imageFilter.value = "";
    searchItems({ resetPage: true });
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
    } catch (_) {
        if (elements.imageStatus) elements.imageStatus.textContent = "Statistiques des images indisponibles.";
        return null;
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
                body: { batchSize: 20, retryMissing }
            });
            updateImageStats(data.stats);
            if (!data.processed) break;
            elements.imageStatus.textContent = `${Number(data.processed).toLocaleString("fr-FR")} objets traités dans le dernier lot…`;
        }
        elements.imageStatus.textContent = stopImageSearchRequested
            ? "Arrêt effectué. Clique à nouveau pour reprendre."
            : "Traitement terminé pour cette sélection.";
    } catch (error) {
        elements.imageStatus.textContent = error.message || "La recherche d'images a échoué.";
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
            body: { onlyMissing: true }
        });
        await runImageSearch({ retryMissing: true });
    } catch (error) {
        elements.imageStatus.textContent = error.message || "Impossible de relancer les absentes.";
        elements.imageRetry.disabled = false;
    }
}

async function importZip() {
    const file = elements.file?.files?.[0];
    if (!file) return setFeedback("Sélectionne d'abord le ZIP contenant tes fichiers types*.xml.", "error");
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
        await Promise.all([loadStats(), loadImageStats(), searchItems({ resetPage: true })]);
    } catch (error) {
        setFeedback(error.message || "L'import a échoué.", "error");
    } finally {
        elements.importButton.disabled = false;
    }
}

export function initializeCatalog({ onBack } = {}) {
    elements.back?.addEventListener("click", onBack);
    elements.importButton?.addEventListener("click", importZip);
    elements.searchButton?.addEventListener("click", () => searchItems({ resetPage: true }));
    elements.resetButton?.addEventListener("click", resetFilters);
    elements.classifyButton?.addEventListener("click", classifyItems);
    elements.editorImageUrl?.addEventListener("input", (event) => updateEditorImagePreview(event.target.value));
    elements.editorCategory?.addEventListener("change", () => {
        populateEditorSubcategory(elements.editorCategory.value, "");
    });
    elements.modFilter?.addEventListener("change", () => searchItems({ resetPage: true }));
    elements.categoryFilter?.addEventListener("change", () => searchItems({ resetPage: true }));
    elements.availabilityFilter?.addEventListener("change", () => searchItems({ resetPage: true }));
    elements.imageFilter?.addEventListener("change", () => searchItems({ resetPage: true }));
    elements.previous?.addEventListener("click", () => {
        state.offset = Math.max(state.offset - state.limit, 0);
        searchItems();
    });
    elements.next?.addEventListener("click", () => {
        state.offset += state.limit;
        searchItems();
    });
    elements.editorForm?.addEventListener("submit", saveEditor);
    elements.editorClose?.addEventListener("click", closeEditor);
    elements.editorCancel?.addEventListener("click", closeEditor);
    elements.editor?.addEventListener("click", event => {
        if (event.target === elements.editor) closeEditor();
    });
    elements.imageStart?.addEventListener("click", () => runImageSearch());
    elements.imageStop?.addEventListener("click", () => { stopImageSearchRequested = true; });
    elements.imageRetry?.addEventListener("click", retryMissingImages);
    elements.search?.addEventListener("keydown", event => {
        if (event.key === "Enter") {
            event.preventDefault();
            searchItems({ resetPage: true });
        }
    });
}

export async function openCatalog() {
    await Promise.all([loadStats(), loadImageStats()]);
    await searchItems({ resetPage: true });
}
