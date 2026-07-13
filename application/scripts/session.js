import { observerConnexion, deconnexion } from "../firebase/firebase-auth.js";

import {
    ensureUserProfile,
    updateUserLastSeen,
    JDM_RGPD_VERSION
} from "../firebase/firebase-db.js";

export function routeForRole(role) {
    if (role === "super_admin") return "administration.html";
    if (role === "admin") return "administration.html";
    if (role === "coach") return "administration.html";
    return "accueil.html";
}

export function roleCanAccess(role, allowedRoles) {
    if (!allowedRoles || allowedRoles.length === 0) return true;
    return allowedRoles.includes(role);
}

export function hasPageAccess(profile, pageKey, type = "lecture") {
    if (!profile) return false;
    if (profile.role === "super_admin") return true;

    const acces = (profile.accesPages || {})[pageKey];
    if (acces === true) return true;

    return acces?.[type] === true;
}

export function canAccess(profile, allowedRoles, pageKey) {
    if (!profile || profile.actif === false) return false;
    if (profile.role === "super_admin") return true;

    if (pageKey) {
        return hasPageAccess(profile, pageKey, "lecture");
    }

    return roleCanAccess(profile.role, allowedRoles);
}

function consentementValide(profile) {
    return profile?.consentementRGPD === true
        && profile?.versionConditions === JDM_RGPD_VERSION;
}

function pageActuelle() {
    return window.location.pathname.split("/").pop() || "";
}

let lastSeenIntervalJDM = null;

export function watchSession(callback) {
    return observerConnexion(async (user) => {
        if (!user) {
            if (lastSeenIntervalJDM) {
                clearInterval(lastSeenIntervalJDM);
                lastSeenIntervalJDM = null;
            }

            callback(null, null);
            return;
        }

        try {
            const profile = await ensureUserProfile(user);

            if (profile.actif === false) {
                await deconnexion();
                window.location.href = "connexion.html";
                return;
            }

            if (!consentementValide(profile) && pageActuelle() !== "premiere-connexion.html") {
                window.location.href = "premiere-connexion.html";
                return;
            }

            if (!lastSeenIntervalJDM) {
                lastSeenIntervalJDM = setInterval(() => {
                    updateUserLastSeen(user.uid).catch(error => {
                        console.warn("Dernière activité non mise à jour", error);
                    });
                }, 60000);
            }

            callback(user, profile);
        } catch (error) {
            console.error("Erreur de session JDM", error);
            await deconnexion().catch(() => {});
            window.location.href = "connexion.html";
        }
    });
}

export async function logoutAndRedirect() {
    await deconnexion();
    window.location.href = "connexion.html";
}
