/**
 * SENZANY
 * Gestion des lignes d'objets pour les livraisons + recherche Supabase
 */

import { apiRequest } from "./api.js";

export function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function normalizeItem(item = {}) {
    const className = item.className || item.classname || "";
    const displayName = item.displayName || item.display_name || className;
    const category = item.category || "Non classé";
    const modName = item.modName || item.mod_name || "Source non identifiée";

    return { className, displayName, category, modName };
}

function attachItemAutocomplete(row) {
    const input = row.querySelector('[name="itemName"]');
    const dropdown = row.querySelector("[data-item-suggestions]");
    const meta = row.querySelector("[data-selected-item-meta]");
    if (!input || !dropdown) return;

    let timer = null;
    let controller = null;
    let activeIndex = -1;
    let currentItems = [];

    const close = () => {
        dropdown.hidden = true;
        dropdown.innerHTML = "";
        activeIndex = -1;
        currentItems = [];
    };

    const selectItem = (item) => {
        input.value = item.className;
        input.dataset.selectedClassname = item.className;
        if (meta) {
            meta.hidden = false;
            meta.textContent = `${item.category} • ${item.modName}`;
        }
        close();
        input.focus();
    };

    const render = (items, message = "") => {
        dropdown.innerHTML = "";
        currentItems = items;
        activeIndex = -1;

        if (!items.length) {
            dropdown.innerHTML = `<div class="admin-item-suggestion admin-item-suggestion--empty">${escapeHtml(message || "Aucun objet trouvé")}</div>`;
            dropdown.hidden = false;
            return;
        }

        items.forEach((item, index) => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "admin-item-suggestion";
            button.dataset.suggestionIndex = String(index);
            button.innerHTML = `
                <strong>${escapeHtml(item.className)}</strong>
                ${item.displayName && item.displayName !== item.className ? `<span>${escapeHtml(item.displayName)}</span>` : ""}
                <small>${escapeHtml(item.category)} • ${escapeHtml(item.modName)}</small>
            `;
            button.addEventListener("mousedown", (event) => {
                event.preventDefault();
                selectItem(item);
            });
            dropdown.appendChild(button);
        });

        dropdown.hidden = false;
    };

    const search = async () => {
        const query = input.value.trim();
        if (query.length < 2) {
            close();
            return;
        }

        controller?.abort();
        controller = new AbortController();
        render([], "Recherche en cours…");

        try {
            const data = await apiRequest(`/api/admin/items?q=${encodeURIComponent(query)}&limit=12`, {
                signal: controller.signal
            });
            const items = (Array.isArray(data?.items) ? data.items : [])
                .map(normalizeItem)
                .filter(item => item.className);
            render(items, "Aucun classname correspondant");
        } catch (error) {
            if (error?.name !== "AbortError") {
                render([], "Recherche indisponible");
            }
        }
    };

    input.addEventListener("input", () => {
        delete input.dataset.selectedClassname;
        if (meta) meta.hidden = true;
        clearTimeout(timer);
        timer = setTimeout(search, 250);
    });

    input.addEventListener("keydown", (event) => {
        if (dropdown.hidden || !currentItems.length) return;

        if (event.key === "ArrowDown") {
            event.preventDefault();
            activeIndex = Math.min(activeIndex + 1, currentItems.length - 1);
        } else if (event.key === "ArrowUp") {
            event.preventDefault();
            activeIndex = Math.max(activeIndex - 1, 0);
        } else if (event.key === "Enter" && activeIndex >= 0) {
            event.preventDefault();
            selectItem(currentItems[activeIndex]);
            return;
        } else if (event.key === "Escape") {
            close();
            return;
        } else {
            return;
        }

        dropdown.querySelectorAll("[data-suggestion-index]").forEach((element, index) => {
            element.classList.toggle("is-active", index === activeIndex);
        });
    });

    input.addEventListener("blur", () => setTimeout(close, 150));
}

export function createItemRow({ className = "", quantity = 1 } = {}) {
    const row = document.createElement("div");
    row.className = "admin-item-row";

    row.innerHTML = `
        <div class="admin-item-picker">
            <input
                type="text"
                name="itemName"
                placeholder="Tape au moins 2 caractères : M4, Cannabis…"
                value="${escapeHtml(className)}"
                autocomplete="off"
                spellcheck="false"
                required
            />
            <small class="admin-item-picker__meta" data-selected-item-meta ${className ? "" : "hidden"}>Objet sélectionné</small>
            <div class="admin-item-suggestions" data-item-suggestions hidden></div>
        </div>

        <input
            type="number"
            name="itemQuantity"
            aria-label="Quantité"
            min="1"
            max="999"
            value="${Number(quantity) || 1}"
            required
        />

        <button type="button" class="admin-button admin-button--small" data-remove-item>Supprimer</button>
    `;

    attachItemAutocomplete(row);

    row.querySelector("[data-remove-item]")?.addEventListener("click", () => {
        const container = row.parentElement;
        row.remove();
        if (container && !container.children.length) container.appendChild(createItemRow());
    });

    return row;
}

export function addItemRow(container, item = {}) {
    if (!container) return null;
    const row = createItemRow(item);
    container.appendChild(row);
    return row;
}

export function clearItemRows(container) {
    if (!container) return;
    container.innerHTML = "";
    addItemRow(container);
}

export function getItemsFromContainer(container) {
    if (!container) return [];

    return [...container.querySelectorAll(".admin-item-row")]
        .map(row => {
            const className = row.querySelector('[name="itemName"]')?.value.trim();
            const quantity = Number(row.querySelector('[name="itemQuantity"]')?.value);
            return { className, name: className, quantity };
        })
        .filter(item => item.className && item.quantity > 0);
}
