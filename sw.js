// Кэшируем только оболочку приложения: страница открывается даже при плохой связи.
// Уроки и прогресс всегда берутся с сервера (последняя версия уроков хранится в localStorage).
const C = "kk-shell-1792415338";
const SHELL = ["./", "index.html", "manifest.json", "icon-192.png", "icon-512.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(C).then(c => c.addAll(SHELL))); self.skipWaiting(); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== C).map(k => caches.delete(k))))); self.clients.claim(); });
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(r => { const cp = r.clone(); caches.open(C).then(c => c.put(e.request, cp)); return r; })
    .catch(() => caches.match(e.request).then(r => r || caches.match("index.html"))));
});

// Пуш-уведомления (Firebase присылает {data:{title, body, url}}): показываем с иконкой КК
self.addEventListener("push", e => {
  let d = {};
  try { const j = e.data.json(); d = j.data || j.notification || j; } catch (x) { d = { body: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.title || "Код Креатора", {
    body: d.body || "", icon: "icon-192.png", badge: "icon-192.png", data: { url: d.url || "./" }
  }));
});
// тап по уведомлению — открываем приложение сразу на нужном экране
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || "./", self.registration.scope).href;
  e.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then(ws => {
    for (const w of ws) if (w.url.startsWith(self.registration.scope) && "focus" in w) return w.focus().then(() => w.navigate ? w.navigate(url) : null);
    return clients.openWindow(url);
  }));
});
