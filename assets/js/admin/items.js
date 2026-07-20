/**
 * SENZANY
 * Gestion des lignes d'objets pour les livraisons
 */

export function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

export function createItemRow({
    className = "",
    quantity = 1
} = {}) {
    const row = document.createElement("div");

    row.className = "admin-item-row";

    row.innerHTML = `
        <input
            type="text"
            name="itemName"
            placeholder="Nom ou classname de l'objet"
            value="${escapeHtml(className)}"
            autocomplete="off"
            required
        />

        <input
            type="number"
            name="itemQuantity"
            min="1"
            max="999"
            value="${Number(quantity) || 1}"
            required
        />

        <button
            type="button"
            class="admin-button admin-button--small"
            data-remove-item
        >
            Supprimer
        </button>
    `;

    const removeButton = row.querySelector("[data-remove-item]");

    removeButton?.addEventListener("click", () => {
        const container = row.parentElement;

        row.remove();

        if (container && !container.children.length) {
            container.appendChild(createItemRow());
        }
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
            const className = row
                .querySelector('[name="itemName"]')
                ?.value
                .trim();

            const quantity = Number(
                row.querySelector('[name="itemQuantity"]')?.value
            );

            return {
                className,
                name: className,
                quantity
            };
        })
        .filter(item => {
            return item.className && item.quantity > 0;
        });
}