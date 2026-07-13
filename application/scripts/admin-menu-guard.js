import {
    watchSession,
    hasPageAccess
} from "./session.js";

watchSession((user, profile) => {
    if (!user || !profile) return;

    const liens = document.querySelectorAll("a.navigation-link[href]");

    liens.forEach(lien => {
        const href = lien.getAttribute("href") || "";

        const pageKey = href
            .split("/")
            .pop()
            .split("?")[0]
            .split("#")[0]
            .replace(/\.html$/i, "");

        if (!pageKey) return;

        const autorise = hasPageAccess(profile, pageKey, "lecture");

        if (!autorise) {
            lien.remove();
        }
    });

    masquerSectionsVides();
});

function masquerSectionsVides() {
    document.querySelectorAll('[id^="section-"]').forEach(section => {
        const liensRestants =
            section.querySelectorAll("a.navigation-link[href]");

        if (liensRestants.length > 0) return;

        section.remove();

        const nomSection = section.id.replace("section-", "");

        const titre = document.querySelector(
            `[onclick="toggleSection('${nomSection}')"]`
        );

        if (titre) {
            titre.remove();
        }
        const page = document.getElementById("admin-page");

if (page) {
    page.style.display = "block";
}
    });
}