// Garage: rende l'app disponibile anche senza connessione.
// Quando pubblichi una nuova versione, cambia VERSIONE.
const VERSIONE = "garage-v1";
const BASE = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./favicon.png",
  "./icon-192.png",
  "./icon-512.png",
  "./maskable-512.png",
  "./apple-touch-icon.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSIONE).then((c) => c.addAll(BASE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSIONE)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // La pagina: prima la rete, così gli aggiornamenti arrivano subito; senza rete, la copia salvata.
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copia = res.clone();
          caches.open(VERSIONE).then((c) => c.put("./index.html", copia));
          return res;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  // File dell'app: prima la copia salvata.
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        const copia = res.clone();
        caches.open(VERSIONE).then((c) => c.put(req, copia));
        return res;
      }))
    );
    return;
  }

  // Caratteri tipografici di Google Fonts: copia salvata, aggiornata in background.
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(
      caches.open(VERSIONE + "-font").then((c) =>
        c.match(req).then((hit) => {
          const rete = fetch(req).then((res) => { c.put(req, res.clone()); return res; }).catch(() => hit);
          return hit || rete;
        })
      )
    );
  }
});
