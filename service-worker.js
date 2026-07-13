/* ==========================================================================
   Service Worker – Packliste Spanien
   Sorgt für vollständige Offline-Nutzbarkeit: beim Installieren wird
   die komplette App-Hülle (HTML, CSS, JS, Daten, Icons) in den Cache
   gelegt. Danach wird ausschließlich aus dem Cache bedient
   (Cache-First), sodass die App auch ohne Internetverbindung
   funktioniert – z. B. im Flugzeug oder am Strand ohne Empfang.
   ========================================================================== */

const CACHE_NAME = "packliste-spanien-v3";

// Alle Dateien, die für den Offline-Betrieb notwendig sind
const APP_SHELL = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./data.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png",
  "./icons/favicon-32.png",
  "./icons/favicon-16.png",
];

// ---------------------------------------------------------------------
// INSTALL: App-Hülle in den Cache legen
// ---------------------------------------------------------------------
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

// ---------------------------------------------------------------------
// ACTIVATE: alte Caches vorheriger Versionen aufräumen
// ---------------------------------------------------------------------
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ---------------------------------------------------------------------
// FETCH: Network-First-Strategie mit Cache-Fallback.
// So wird bei bestehender Internetverbindung immer die aktuelle Version
// geladen (wichtig während der Weiterentwicklung der App). Nur wenn das
// Netzwerk nicht erreichbar ist (z. B. im Flugzeug, am Strand ohne
// Empfang), wird auf die zuletzt gecachte Version zurückgegriffen.
// ---------------------------------------------------------------------
self.addEventListener("fetch", (event) => {
  // Nur GET-Anfragen behandeln, alles andere unangetastet lassen
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
