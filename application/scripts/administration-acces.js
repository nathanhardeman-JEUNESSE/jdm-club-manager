import { observerConnexion } from "../firebase/firebase-auth.js";
import { ensureUserProfile } from "../firebase/firebase-db.js";
import { hasPageAccess } from "./session.js";

const liensAdmin = [
    { href: "admin-appel.html", key: "admin-appel" },
    { href: "admin-absences.html", key: "admin-absences" },
    { href: "admin-planning.html", key: "admin-planning" },
    { href: "admin-groupes.html", key: "admin-groupes" },
    { href: "admin-adherents.html", key: "admin-adherents" },
    { href: "admin-competitions.html", key: "admin-competitions" },
    { href: "admin-import-helloasso.html", key: "admin-import-helloasso" },
    { href: "admin-aide-licence.html", key: "admin-aide-licence" },
    { href: "admin-organisation.html", key: "admin-organisation" },
    { href: "admin-notifications-tresorier.html", key: "admin-notifications-tresorier" },
    { href: "admin-tableau-bord.html", key: "admin-tableau-bord" },
    { href: "admin-contenu-site.html", key: "admin-contenu-site" },
    { href: "admin-boutique.html", key: "admin-boutique" },
    { href: "admin-commandes.html", key: "admin-commandes" },
    { href: "admin-utilisateurs.html", key: "admin-utilisateurs", superAdminOnly: true },
    { href: "dev.html", key: "dev" },
    { href: "admin-assistant-rentree.html", key: "admin-assistant-rentree" }
];

function lienParHref(href) {
    return Array.from(document.querySelectorAll("a.navigation-link"))
        .find(lien => lien.getAttribute("href") === href);
}

observerConnexion(async (user) => {
    if (!user) return;

    const profile = await ensureUserProfile(user);

    liensAdmin.forEach(item => {
        const lien = lienParHref(item.href);
        if (!lien) return;

        if (profile.role === "super_admin") {
            lien.style.display = "";
            return;
        }

        if (item.superAdminOnly) {
            lien.style.display = "none";
            return;
        }

        lien.style.display = hasPageAccess(profile, item.key, "lecture") ? "" : "none";
    });
});
