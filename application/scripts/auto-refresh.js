const VERSION_URL = "../version.json";
const CHECK_INTERVAL_MS = 60_000;
const STORAGE_KEY = "jdm-app-version";

let verificationEnCours = false;

async function lireVersion() {
    const separateur = VERSION_URL.includes("?") ? "&" : "?";
    const reponse = await fetch(
        `${VERSION_URL}${separateur}t=${Date.now()}`,
        { cache: "no-store" }
    );

    if (!reponse.ok) throw new Error(`Version HTTP ${reponse.status}`);
    const data = await reponse.json();
    return String(data.version || "").trim();
}

async function verifierNouvelleVersion() {
    if (verificationEnCours) return;
    verificationEnCours = true;

    try {
        const versionServeur = await lireVersion();
        if (!versionServeur) return;

        const versionLocale = sessionStorage.getItem(STORAGE_KEY);

        if (!versionLocale) {
            sessionStorage.setItem(STORAGE_KEY, versionServeur);
            return;
        }

        if (versionLocale !== versionServeur) {
            sessionStorage.setItem(STORAGE_KEY, versionServeur);

            if ("caches" in window) {
                const noms = await caches.keys();
                await Promise.all(noms.map(nom => caches.delete(nom)));
            }

            const url = new URL(window.location.href);
            url.searchParams.set("jdmv", versionServeur);
            window.location.replace(url.toString());
        }
    } catch (error) {
        console.debug("Vérification de version indisponible", error);
    } finally {
        verificationEnCours = false;
    }
}

verifierNouvelleVersion();
setInterval(verifierNouvelleVersion, CHECK_INTERVAL_MS);
window.addEventListener("focus", verifierNouvelleVersion);
document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") verifierNouvelleVersion();
});
