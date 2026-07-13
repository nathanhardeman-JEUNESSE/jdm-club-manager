import { watchSession, hasPageAccess } from "./session.js";

const pagesPubliques = new Set([
    "accueil",
    "actualites",
    "mon-club",
    "planning",
    "boutique",
    "boutique-accessoires",
    "boutique-ephemere",
    "documents",
    "contact",
    "connexion",
    "inscription",
    "premiere-connexion"
]);

watchSession((user, profile) => {
    const page = document.querySelector(".page");

    document.querySelectorAll('a[href*=".html"]').forEach(lien => {
        const href = lien.getAttribute("href") || "";

        const pageKey = href
            .split("/")
            .pop()
            .split("?")[0]
            .split("#")[0]
            .replace(/\.html$/i, "");

        if (!pageKey) return;

        let visible = false;

/* Administration : contrôle strict */
if (pageKey === "administration") {
    visible =
        profile?.role === "super_admin" ||
        profile?.accesPages?.administration?.lecture === true;

/* Pages publiques */
} else if (pagesPubliques.has(pageKey)) {
    visible = true;

/* Portail membre visible pour permettre la connexion */
} else if (pageKey === "espace-membre") {
    visible = true;

/* Super-admin : tous les autres accès */
} else if (profile?.role === "super_admin") {
    visible = true;

/* Autres comptes : autorisation individuelle */
} else if (user && profile) {
    visible = hasPageAccess(profile, pageKey, "lecture");
}

        lien.style.display = visible ? "" : "none";
    });

    document.querySelectorAll('[id^="section-"]').forEach(section => {
        const liensVisibles = [...section.querySelectorAll('a[href*=".html"]')]
            .some(lien => lien.style.display !== "none");

        section.style.display = liensVisibles ? "" : "none";
    });

    if (page) {
        const cartes = [
    ...document.querySelectorAll(
        ".navigation-card, .news-card, .card"
    )
].filter(carte => {
    const parentLien = carte.closest("a");

    return !parentLien || parentLien.style.display !== "none";
});

cartes.forEach((carte, index) => {
    carte.classList.add("jdm-card-reveal");

    setTimeout(() => {
        carte.classList.add("jdm-card-visible");
    }, index * 120);
});
        page.classList.remove("page-loading");
        page.classList.add("page-ready");
    }
});