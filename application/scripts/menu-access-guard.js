import { watchSession, hasPageAccess } from "./session.js";

watchSession((user, profile) => {
    if (!user || !profile) return;

    document
        .querySelectorAll("a.navigation-link[href]")
        .forEach(lien => {
            const href = lien.getAttribute("href") || "";

            const pageKey = href
                .split("/")
                .pop()
                .split("?")[0]
                .split("#")[0]
                .replace(/\.html$/i, "");

            if (!pageKey) return;

            const autorise = hasPageAccess(
                profile,
                pageKey,
                "lecture"
            );

            if (!autorise) {
                lien.remove();
            }
        });
});