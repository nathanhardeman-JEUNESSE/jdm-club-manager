import {
    watchSession,
    canAccess,
    hasPageAccess
} from "./session.js";

const baliseGuard = document.querySelector(
    'script[src*="auth-guard.js"][data-page]'
);

const pageKey = baliseGuard?.dataset.page || "";

const allowedRoles = (baliseGuard?.dataset.roles || "")
    .split(",")
    .map(role => role.trim())
    .filter(Boolean);

watchSession((user, profile) => {
    /* Pas connecté : portail de connexion */
    if (!user || !profile) {
        window.location.replace("connexion.html");
        return;
    }

    /* Pas de droit Lecture : retour accueil */
    if (!canAccess(profile, allowedRoles, pageKey)) {
        window.location.replace("accueil.html");
        return;
    }

    /* Lecture autorisée mais pas écriture */
    if (!hasPageAccess(profile, pageKey, "ecriture")) {
        document
            .querySelectorAll(
                "input, select, textarea, button, [contenteditable='true']"
            )
            .forEach(element => {
                if (
                    element.dataset.noLock === "true" ||
                    element.classList.contains("back-button")
                ) {
                    return;
                }

                element.disabled = true;
            });
    }
});