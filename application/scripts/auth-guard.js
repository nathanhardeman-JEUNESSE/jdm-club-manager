import { watchSession, canAccess, hasPageAccess } from "./session.js";

const script = document.currentScript;

const allowedRoles = (script?.dataset.roles || "")
    .split(",")
    .map(role => role.trim())
    .filter(Boolean);

const pageKey = script?.dataset.page || "";

watchSession(async (user, profile) => {

    if (!profile) return;

    if (!canAccess(profile, allowedRoles, pageKey)) {

        alert("Vous n'avez pas l'autorisation d'accéder à cette page.");

        window.location.href = "accueil.html";

        return;
    }

    if (!hasPageAccess(profile, pageKey, "ecriture")) {

        document
            .querySelectorAll("input, select, textarea, button")

            .forEach(element => {

                if (
                    element.classList.contains("back-button") ||
                    element.dataset.noLock === "true"
                ) {
                    return;
                }

                element.disabled = true;
            });
    }

});