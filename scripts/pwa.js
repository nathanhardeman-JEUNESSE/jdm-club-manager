let deferredInstallPrompt = null;

const androidButton = document.getElementById("installAndroidButton");
const iphoneButton = document.getElementById("installIphoneButton");
const iosInstructions = document.getElementById("iosInstructions");

const isIos = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
const isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;

if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("sw.js");
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
        iosInstructions.hidden = !iosInstructions.hidden;
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
