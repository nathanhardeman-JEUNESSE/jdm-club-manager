import { watchSession, hasPageAccess } from "./session.js";

watchSession((user, profile) => {
    if (!user || !profile) return;

    document.querySelectorAll("a.navigation-link[href]").forEach((lien) => {
        const url = lien.getAttribute("href") || "";

        const pageKey = url
            .split("/")
            .pop()
            .split("?")[0]
            .split("#")[0]
            .replace(".html", "");

        if (!pageKey) return;

        const autorise = hasPageAccess(profile, pageKey, "lecture");

        if (!autorise) {
            lien.remove();
        }
    });

    masquerSectionsVides();
});

function masquerSectionsVides() {
    document.querySelectorAll('[id^="section-"]').forEach((section) => {
        const liensVisibles = section.querySelectorAll("a.navigation-link");

        if (liensVisibles.length === 0) {
            section.style.display = "none";

            const nomSection = section.id.replace("section-", "");
            const titreSection = document.querySelector(
                `[onclick="toggleSection('${nomSection}')"]`
            );

            if (titreSection) {
                titreSection.style.display = "none";
            }
        }
    });
}