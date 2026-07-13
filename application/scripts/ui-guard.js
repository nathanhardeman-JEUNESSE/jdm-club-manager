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

        if (pagesPubliques.has(pageKey)) {
            visible = true;
        } else if (pageKey === "espace-membre") {
            visible = true;
        } else if (profile?.role === "super_admin") {
            visible = true;
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
        page.classList.remove("page-loading");
        page.classList.add("page-ready");
    }
});