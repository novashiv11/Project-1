/* LifeOS service worker: offline app shell + daily due reminders (Periodic Background Sync, Chrome/Android). */
const CACHE = "lifeos-__VERSION__";
const SHELL = ["./", "index.html", "pwa.js", "manifest.json", "icon-192.png", "icon-512.png"];

self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL))); self.skipWaiting(); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  if (req.mode === "navigate") {  // network first so updates arrive; cache when offline
    e.respondWith(fetch(req).then(r => { caches.open(CACHE).then(c => c.put("index.html", r.clone())); return r; })
      .catch(() => caches.match("index.html")));
    return;
  }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
    if (r.ok && (new URL(req.url).origin === location.origin || req.url.startsWith("https://fonts."))) {
      const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy));
    }
    return r;
  })));
});

function kv(key, value) {
  return new Promise((ok, no) => {
    const r = indexedDB.open("lifeos", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("kv");
    r.onerror = () => no(r.error);
    r.onsuccess = () => {
      const tx = r.result.transaction("kv", value === undefined ? "readonly" : "readwrite").objectStore("kv");
      const q = value === undefined ? tx.get(key) : tx.put(value, key);
      q.onsuccess = () => ok(q.result); q.onerror = () => no(q.error);
    };
  });
}
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

async function checkDue() {
  const items = JSON.parse((await kv("items")) || "[]");
  const due = items.filter(i => i.due && !i.done && i.due.slice(0, 10) <= today());
  if (!due.length || (await kv("notified")) === today()) return;
  await kv("notified", today());
  await self.registration.showNotification(`${due.length} thing${due.length > 1 ? "s" : ""} due today`, {
    body: due.slice(0, 3).map(i => "• " + i.text).join("\n"), icon: "icon-192.png", badge: "icon-192.png", tag: "lifeos-due"
  });
}
self.addEventListener("periodicsync", e => { if (e.tag === "lifeos-due") e.waitUntil(checkDue()); });
self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: "window" }).then(cs => cs.length ? cs[0].focus() : self.clients.openWindow("./")));
});
