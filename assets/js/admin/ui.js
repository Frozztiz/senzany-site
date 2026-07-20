/**
 * SENZANY
 * Gestion de l'interface du terminal Staff
 */

export function show(element) {
    if (element) {
        element.hidden = false;
    }
}

export function hide(element) {
    if (element) {
        element.hidden = true;
    }
}

export function hideAll(elements) {
    elements.forEach(el => {
        if (el) {
            el.hidden = true;
        }
    });
}

export function showFeedback(element, message, type = "success") {

    if (!element) return;

    element.hidden = false;
    element.textContent = message;

    element.classList.remove(
        "admin-feedback--success",
        "admin-feedback--error",
        "admin-feedback--warning"
    );

    switch (type) {

        case "success":
            element.classList.add("admin-feedback--success");
            break;

        case "warning":
            element.classList.add("admin-feedback--warning");
            break;

        default:
            element.classList.add("admin-feedback--error");
            break;
    }
}

export function clearFeedback(element) {

    if (!element) return;

    element.hidden = true;
    element.textContent = "";

    element.classList.remove(
        "admin-feedback--success",
        "admin-feedback--error",
        "admin-feedback--warning"
    );
}

export function setLoading(button, loading = true) {

    if (!button) return;

    if (loading) {

        button.dataset.originalText = button.textContent;

        button.disabled = true;
        button.textContent = "Chargement...";

    } else {

        button.disabled = false;

        if (button.dataset.originalText) {
            button.textContent = button.dataset.originalText;
        }

    }
}