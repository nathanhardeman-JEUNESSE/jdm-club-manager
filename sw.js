const CACHE_NAME = "jdm-club-manager-runtime-v2";

const APP_SHELL = [
    "./",
    "./index.html",
    "./manifest.json",
    "./styles/install.css",
    "./scripts/pwa.js",
    "./images/icon-192.png",
    "./images/icon-512.png",
    "./application/pages/accueil.html",
    "./application/styles/theme.css",
    "./application/styles/components.css"
];

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(APP_SHELL))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        Promise.all([
            caches.keys().then((keys) =>
                Promise.all(
                    keys
                        .filter((key) => key !== CACHE_NAME)
                        .map((key) => caches.delete(key))
                )
            ),
            self.clients.claim()
        ])
    );
});

async function networkFirst(request) {
    const cache = await caches.open(CACHE_NAME);

    try {
        const response = await fetch(request, { cache: "no-store" });

        if (response && response.ok) {
            await cache.put(request, response.clone());
        }

        return response;
    } catch (error) {
        const cachedResponse = await cache.match(request);

        if (cachedResponse) {
            return cachedResponse;
        }

        if (request.mode === "navigate") {
            return cache.match("./index.html");
        }

        throw error;
    }
}

async function cacheFirst(request) {
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(request);

    if (cachedResponse) {
        return cachedResponse;
    }

    const response = await fetch(request);

    if (response && response.ok) {
        await cache.put(request, response.clone());
    }

    return response;
}

self.addEventListener("fetch", (event) => {
    const request = event.request;

    if (request.method !== "GET") return;

    const url = new URL(request.url);

    if (url.origin !== self.location.origin) return;

    const isImage = request.destination === "image";

    event.respondWith(
        isImage ? cacheFirst(request) : networkFirst(request)
    );
});
