let deferredInstallPrompt = null;
let serviceWorkerRefreshing = false;

const androidButton = document.getElementById("installAndroidButton");
const iphoneButton = document.getElementById("installIphoneButton");
const iosInstructions = document.getElementById("iosInstructions");

const isIos = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
const isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;

if ("serviceWorker" in navigator) {
    window.addEventListener("load", async () => {
        try {
            const registration = await navigator.serviceWorker.register("/sw.js", {
                updateViaCache: "none"
            });

            await registration.update();

            window.setInterval(() => {
                registration.update().catch(() => {});
            }, 5 * 60 * 1000);

            document.addEventListener("visibilitychange", () => {
                if (document.visibilityState === "visible") {
                    registration.update().catch(() => {});
                }
            });
        } catch (error) {
            console.error("Impossible d'enregistrer le Service Worker :", error);
        }
    });

    navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (serviceWorkerRefreshing) return;
        serviceWorkerRefreshing = true;
        window.location.reload();
    });
}

window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;

    if (!isStandalone && androidButton) {
        androidButton.hidden = false;
    }
});

if (androidButton) {
    androidButton.addEventListener("click", async () => {
        if (!deferredInstallPrompt) return;

        deferredInstallPrompt.prompt();
        await deferredInstallPrompt.userChoice;
        deferredInstallPrompt = null;
        androidButton.hidden = true;
    });
}

if (iphoneButton) {
    iphoneButton.addEventListener("click", () => {
        if (iosInstructions) {
            iosInstructions.hidden = !iosInstructions.hidden;
        }
    });

    if (!isIos || isStandalone) {
        iphoneButton.hidden = true;
    }
}

if (isStandalone) {
    if (androidButton) androidButton.hidden = true;
    if (iphoneButton) iphoneButton.hidden = true;
    if (iosInstructions) iosInstructions.hidden = true;
}
