import { observerConnexion, deconnexion } from "../firebase/firebase-auth.js";
import { ensureUserProfile, updateUserLastSeen } from "../firebase/firebase-db.js";

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

export function hasPageAccess(profile, pageKey) {
    if (!profile) return false;
    if (profile.role === "super_admin") return true;
    if (profile.role === "admin") return true;

    const accesPages = profile.accesPages || {};
    return accesPages[pageKey] === true;
}

export function canAccess(profile, allowedRoles, pageKey) {
    if (!profile) return false;
    if (profile.role === "super_admin") return true;

    if (pageKey && hasPageAccess(profile, pageKey)) return true;

    return roleCanAccess(profile.role, allowedRoles);
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

        const profile = await ensureUserProfile(user);

        if (!lastSeenIntervalJDM) {
            lastSeenIntervalJDM = setInterval(() => {
                updateUserLastSeen(user.uid).catch(error => console.warn("lastSeen non mis à jour", error));
            }, 60000);
        }

        callback(user, profile);
    });
}

export async function logoutAndRedirect() {
    await deconnexion();
    window.location.href = "connexion.html";
}
