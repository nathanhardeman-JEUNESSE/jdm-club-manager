import { observerConnexion } from "../firebase/firebase-auth.js";
import { ensureUserProfile } from "../firebase/firebase-db.js";
import { canAccess } from "./session.js";

const pageRoles = document.currentScript.dataset.roles
    ? document.currentScript.dataset.roles.split(",").map(r => r.trim())
    : [];

const pageKey = document.currentScript.dataset.page || "";

observerConnexion(async (user) => {
    if (!user) {
        window.location.href = "connexion.html";
        return;
    }

    const profile = await ensureUserProfile(user);

    if (!profile || profile.actif === false) {
        alert("Compte désactivé.");
        window.location.href = "connexion.html";
        return;
    }

    if (!canAccess(profile, pageRoles, pageKey)) {
        alert("Accès non autorisé.");
        window.location.href = "accueil.html";
    }
});
