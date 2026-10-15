/* Phone-app layer for the standalone LifeOS build (not used in the claude.ai version).
   - offline via service worker
   - mirrors items to IndexedDB so the service worker can send due reminders
   - "Reminders" button asks for notification permission and registers a daily background check */
(() => {
  if (!("serviceWorker" in navigator)) return;
  const DB = "lifeos", STORE = "kv";
  const idb = () => new Promise((ok, no) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error);
  });
  async function mirror() {
    try {
      const db = await idb();
      db.transaction(STORE, "readwrite").objectStore(STORE).put(JSON.stringify(plan()), "nudges");
    } catch (e) {}
  }
  const save = localBackend.save.bind(localBackend);
  localBackend.save = () => { save(); mirror(); };
  localBackend.label = "Private · saved on this phone";
  if (backend === localBackend) note(localBackend.label);

  const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  // Every date worth a notification: due dates, plus the day a long-notice renewal window opens (e.g. IRP: 84 days before).
  // Computed here (the page knows lead times) and stored for the service worker, which only has to compare dates.
  function plan() {
    const out = [];
    for (const i of items.values()) {
      if (!i.due || i.done) continue;
      const d = i.due.slice(0, 10);
      out.push({ date: d, kind: "due", text: i.text });
      const lead = leadDays(i);
      if (lead > 14) out.push({ date: iso(addDays(fromIso(d), -lead)), kind: "window", text: i.text });
    }
    return out;
  }
  // Same rule as sw.js nudgeLines(): keep both in sync.
  const nudgeLines = (nudges, t) => [
    ...nudges.filter(n => n.kind === "window" && n.date === t).map(n => "Start now: " + n.text),
    ...nudges.filter(n => n.kind === "due" && n.date === t).map(n => "Today: " + n.text),
    ...nudges.filter(n => n.kind === "due" && n.date < t).map(n => "Overdue: " + n.text)];

  async function notifyOnOpen(reg) {
    // Backup for phones without background sync: one nudge per day when the app is opened.
    if (Notification.permission !== "granted") return;
    let last = ""; try { last = localStorage.getItem("lifeos.notified") || ""; } catch (e) {}
    const lines = nudgeLines(plan(), today());
    if (!lines.length || last === today()) return;
    try { localStorage.setItem("lifeos.notified", today()); } catch (e) {}
    reg.showNotification(lines.length === 1 ? lines[0] : `${lines.length} things need you today`, {
      body: lines.slice(0, 4).join("\n"), icon: "icon-192.png", badge: "icon-192.png", tag: "lifeos-due"
    });
  }
  async function enableReminders(reg, btn) {
    const p = await Notification.requestPermission();
    if (p !== "granted") { btn.textContent = "Reminders blocked in phone settings"; return; }
    try { await reg.periodicSync.register("lifeos-due", { minInterval: 12 * 60 * 60 * 1000 }); } catch (e) {}
    btn.hidden = true;
    reg.showNotification("Reminders on ✓", { body: "LifeOS will nudge you when something is due.", icon: "icon-192.png" });
  }

  // ---- one-tap install -------------------------------------------------
  const standalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  let installEvt = null;
  function headerButton(id, text, onClick) {
    let b = document.getElementById(id);
    if (!b) {
      b = document.createElement("button");
      b.id = id; b.type = "button"; b.className = "go"; b.style.padding = "10px 14px";
      (document.getElementById("banners") || document.querySelector("header")).appendChild(b);
    }
    b.textContent = text; b.onclick = onClick; b.hidden = false;
    return b;
  }
  window.addEventListener("beforeinstallprompt", e => {
    e.preventDefault(); installEvt = e;
    headerButton("install", "📲 Install app", async () => {
      installEvt.prompt();
      const { outcome } = await installEvt.userChoice;
      if (outcome === "accepted") document.getElementById("install").hidden = true;
      installEvt = null;
    });
  });
  window.addEventListener("appinstalled", () => {
    const b = document.getElementById("install"); if (b) b.hidden = true;
    toast("Installed. Open LifeOS from your home screen.", false);
  });
  async function alreadyInstalledHint() {
    if (standalone() || !navigator.getInstalledRelatedApps) return;
    try {
      const apps = await navigator.getInstalledRelatedApps();
      if (apps.length) note("Installed ✓ · open LifeOS from your home screen");
    } catch (e) {}
  }

  window.addEventListener("load", async () => {
    alreadyInstalledHint();
    const reg = await navigator.serviceWorker.register("sw.js");
    await navigator.serviceWorker.ready;
    mirror();
    if ("Notification" in window && Notification.permission !== "granted") {
      const btn = document.createElement("button");
      btn.className = "go"; btn.type = "button"; btn.id = "remind"; btn.style.padding = "10px 14px";
      btn.textContent = "🔔 Turn on reminders";
      btn.addEventListener("click", () => enableReminders(reg, btn));
      (document.getElementById("banners") || document.querySelector("header")).appendChild(btn);
    } else notifyOnOpen(reg);
  });
})();
