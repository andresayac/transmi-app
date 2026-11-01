/* TransMi service worker — v3
 * - Static build assets: cache first (they are content-hashed)
 * - Catalog APIs (stations, troncales, recharge points, fare): stale-while-revalidate
 * - Live APIs (buses, arrivals, ETAs, planner, assistant): network only
 * - Pages: network first, cached copy when offline, then the offline shell
 */
const VERSION = 'transmi-v3.1.0';
const STATIC_CACHE = `${VERSION}-static`;
const DATA_CACHE = `${VERSION}-data`;
const PAGE_CACHE = `${VERSION}-pages`;

const SHELL = ['/', '/explorar', '/favoritos', '/planear', '/manifest.json', '/icon-192.png', '/icon-512.png'];

const CATALOG_API = [/\/api\/stations(\?|$)/, /\/api\/troncales/, /\/api\/zonas/, /\/api\/puntos/, /\/api\/info/, /\/api\/routes\/detail/];

self.addEventListener('install', (event) => {
    event.waitUntil(caches.open(PAGE_CACHE).then((cache) => cache.addAll(SHELL)).catch(() => undefined));
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
    );
    self.clients.claim();
});

async function cacheFirst(request) {
    const cached = await caches.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok) (await caches.open(STATIC_CACHE)).put(request, response.clone());
    return response;
}

async function staleWhileRevalidate(request) {
    const cache = await caches.open(DATA_CACHE);
    const cached = await cache.match(request);
    const network = fetch(request)
        .then((response) => {
            if (response.ok) cache.put(request, response.clone());
            return response;
        })
        .catch(() => cached);
    return cached || network;
}

async function networkFirstPage(request) {
    const cache = await caches.open(PAGE_CACHE);
    try {
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
    } catch {
        return (await cache.match(request, { ignoreSearch: true })) || (await cache.match('/')) || Response.error();
    }
}

self.addEventListener('fetch', (event) => {
    const { request } = event;
    if (request.method !== 'GET') return;
    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;

    if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/assets/') || /\.(png|svg|ico|woff2?)$/.test(url.pathname)) {
        event.respondWith(cacheFirst(request));
        return;
    }

    if (url.pathname.startsWith('/api/')) {
        if (CATALOG_API.some((re) => re.test(url.pathname + url.search))) event.respondWith(staleWhileRevalidate(request));
        return; // live data: straight to the network
    }

    if (request.mode === 'navigate') {
        event.respondWith(networkFirstPage(request));
    }
});

// Trip alarms posted from the page while it is in the background
self.addEventListener('message', (event) => {
    const data = event.data || {};
    if (data.type === 'notify' && self.registration.showNotification) {
        self.registration.showNotification(data.title || 'TransMi', {
            body: data.body || '',
            icon: '/icon-192.png',
            badge: '/icon-192.png',
            tag: data.tag || 'transmi',
            renotify: true,
            vibrate: [200, 100, 200, 100, 400],
            data: { url: data.url || '/viaje' },
        });
    }
});

// Trip alerts from TransMi's server while the app is closed (see src/lib/tripAlerts.ts)
self.addEventListener('push', (event) => {
    let data = {};
    try {
        data = event.data ? event.data.json() : {};
    } catch {
        data = { body: event.data ? event.data.text() : '' };
    }
    event.waitUntil(
        self.registration.showNotification(data.title || 'TransMi', {
            body: data.body || '',
            icon: '/icon-192.png',
            badge: '/icon-192.png',
            tag: data.tag || 'transmi',
            // Same tag as the alert the phone may have given itself: replace it without ringing twice
            renotify: false,
            vibrate: [200, 100, 200, 100, 400],
            data: { url: data.url || '/viaje' },
        })
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const target = (event.notification.data && event.notification.data.url) || '/';
    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
            const existing = clients.find((c) => new URL(c.url).pathname === target);
            if (existing) return existing.focus();
            return self.clients.openWindow(target);
        })
    );
});
