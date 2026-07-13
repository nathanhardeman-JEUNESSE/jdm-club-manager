import {
    watchSession,
    canAccess,
    hasPageAccess
} from "./session.js";

const baliseGuard = [...document.querySelectorAll('script[src*="auth-guard.js"]')].pop();

const pageKey = baliseGuard?.dataset.page || "";

const allowedRoles = (baliseGuard?.dataset.roles || "")
    .split(",")
    .map(role => role.trim())
    .filter(Boolean);

/* ================================================= */
/* RESTAURATION DE LA POSITION DANS LA PAGE */
/* ================================================= */

const clePosition = `jdm-scroll-${window.location.pathname}`;

window.addEventListener("pagehide", () => {
    sessionStorage.setItem(clePosition, String(window.scrollY));
});

window.addEventListener("pageshow", () => {
    const position = Number(sessionStorage.getItem(clePosition) || 0);

    requestAnimationFrame(() => {
        window.scrollTo(0, position);
    });
});

/* ================================================= */
/* CONTRÔLE DES ACCÈS */
/* ================================================= */

watchSession(async (user, profile) => {

    if (!user || !profile) {
        window.location.href = "connexion.html";
        return;
    }

    if (!canAccess(profile, allowedRoles, pageKey)) {
        alert("Vous n'avez pas l'autorisation d'accéder à cette page.");
        window.location.href = "accueil.html";
        return;
    }

    const droitEcriture = hasPageAccess(profile, pageKey, "ecriture");

    document.documentElement.dataset.jdmEcriture =
        droitEcriture ? "true" : "false";

    if (!droitEcriture) {
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