// Garage: rende l'app disponibile anche senza connessione.
// Quando pubblichi una nuova versione, cambia VERSIONE.
const VERSIONE = "garage-v5";
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
      .then((keys) => Promise.all(keys.filter((k) => (k.startsWith("garage-v") || k.startsWith("libretto-auto")) && !k.startsWith(VERSIONE)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // La pagina: sempre la versione più recente dalla rete (senza la cache del browser); senza rete, la copia salvata.
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req.url, { cache: "no-store", credentials: "same-origin" })
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

// ---------- Promemoria ----------
// La pagina salva in "garage-promemoria" l'elenco delle scadenze con la data in cui avvisare.
const PROM = "garage-promemoria";
async function leggi(nome) {
  const c = await caches.open(PROM);
  const r = await c.match(nome);
  return r ? r.json() : null;
}
async function scrivi(nome, obj) {
  const c = await caches.open(PROM);
  await c.put(nome, new Response(JSON.stringify(obj), { headers: { "Content-Type": "application/json" } }));
}
function oggiISO() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function giorniTra(a, b) {
  const p = (s) => { const x = s.split("-").map(Number); return Date.UTC(x[0], x[1] - 1, x[2]); };
  return Math.round((p(b) - p(a)) / 86400000);
}
function quando(v, d) {
  if (v.tipo === "manutenzione") return d < 0 ? "da fare da " + (-d) + (d === -1 ? " giorno" : " giorni") : "da fare";
  if (d < 0) return "scaduta da " + (-d) + (d === -1 ? " giorno" : " giorni");
  if (d === 0) return "oggi";
  if (d === 1) return "domani";
  return "tra " + d + " giorni" + (v.stima ? " (stima dai km)" : "");
}
async function controllaPromemoria() {
  const dati = await leggi("promemoria.json");
  if (!dati || !dati.attive || !Array.isArray(dati.voci)) return;
  const fatti = (await leggi("notificati.json")) || {};
  const oggi = oggiISO();
  const nuovi = [];
  for (const v of dati.voci) {
    if (!v || typeof v.data !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v.data)) continue;
    const d = giorniTra(oggi, v.data);
    const fase = v.tipo === "manutenzione" ? (d <= 0 ? "0" : null) : (d <= 0 ? "0" : d <= 7 ? "7" : d <= 30 ? "30" : null);
    if (!fase) continue;
    const chiave = v.id + "|" + v.data + "|" + fase;
    if (fatti[chiave]) continue;
    nuovi.push({ v, d, chiave });
  }
  if (!nuovi.length) return;
  nuovi.sort((a, b) => a.d - b.d);
  const righe = nuovi.slice(0, 5).map((n) => n.v.titolo + ": " + quando(n.v, n.d));
  if (nuovi.length > 5) righe.push("e altre " + (nuovi.length - 5));
  const titolo = nuovi.length === 1 ? nuovi[0].v.titolo : "Garage: " + nuovi.length + " promemoria";
  const corpo = nuovi.length === 1 ? quando(nuovi[0].v, nuovi[0].d) : righe.join("\n");
  const tab = nuovi.every((n) => n.v.tipo === "manutenzione") ? "manutenzione" : "scadenze";
  await self.registration.showNotification(titolo, { body: corpo, icon: "icon-192.png", tag: "garage-promemoria", renotify: true, data: { tab } });
  const limite = giorniTra("2000-01-01", oggi) - 400;
  for (const k of Object.keys(fatti)) { if (giorniTra("2000-01-01", fatti[k]) < limite) delete fatti[k]; }
  for (const n of nuovi) fatti[n.chiave] = oggi;
  await scrivi("notificati.json", fatti);
}
self.addEventListener("periodicsync", (e) => {
  if (e.tag === "garage-promemoria") e.waitUntil(controllaPromemoria().catch(() => {}));
});
self.addEventListener("message", (e) => {
  if (e.data && e.data.tipo === "controlla") e.waitUntil(controllaPromemoria().catch(() => {}));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const tab = (e.notification.data && e.notification.data.tab) || "scadenze";
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((lista) => {
      for (const c of lista) {
        if ("focus" in c) { c.postMessage({ tipo: "apri", tab }); return c.focus(); }
      }
      return self.clients.openWindow("./#" + tab);
    })
  );
});
