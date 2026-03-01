const CACHE_NAME = 'nksss-v6';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/logo.png',
];

// Install: pre-cache critical assets
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(STATIC_ASSETS);
        }).then(() => self.skipWaiting())
    );
});

// Activate: clean old caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames
                    .filter(name => name !== CACHE_NAME)
                    .map(name => caches.delete(name))
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch: Network First with cache fallback for navigation and assets
self.addEventListener('fetch', event => {
    if (!event.request.url.startsWith('http')) return;

    const url = new URL(event.request.url);

    // Skip Firebase/Google API calls — never cache these
    if (
        url.hostname.includes('firebaseio.com') ||
        url.hostname.includes('firestore.googleapis.com') ||
        url.hostname.includes('googleapis.com') ||
        url.hostname.includes('firebase.googleapis.com') ||
        url.hostname.includes('identitytoolkit.googleapis.com')
    ) {
        return;
    }

    // For navigation and page requests: Network first, fallback to cache
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    // Cache a clone for offline usage
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                    return response;
                })
                .catch(() => {
                    return caches.match(event.request).then(cached => {
                        return cached || caches.match('/index.html');
                    });
                })
        );
        return;
    }

    // For static assets (JS, CSS, images): Stale-while-revalidate
    if (event.request.destination === 'script' || event.request.destination === 'style' ||
        event.request.destination === 'image' || event.request.destination === 'font') {
        event.respondWith(
            caches.match(event.request).then(cached => {
                const fetchPromise = fetch(event.request).then(response => {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                    return response;
                }).catch(() => cached);

                return cached || fetchPromise;
            })
        );
        return;
    }

    // Default: network only
    event.respondWith(
        fetch(event.request).catch(() => {
            return caches.match(event.request);
        })
    );
});

// Push Notifications
self.addEventListener('push', function (event) {
    if (event.data) {
        let payload = { title: "NKSSS", body: "You have a new notification.", url: "/" };
        try {
            payload = event.data.json();
        } catch (e) {
            payload.body = event.data.text();
        }

        const options = {
            body: payload.body,
            icon: '/logo.png',
            badge: '/logo.png',
            vibrate: [100, 50, 100],
            data: { url: payload.url || "/" },
            actions: payload.actions || [],
        };

        event.waitUntil(
            self.registration.showNotification(payload.title || "NKSSS", options)
        );
    }
});

// Notification click handler
self.addEventListener('notificationclick', function (event) {
    event.notification.close();

    const urlToOpen = event.notification.data.url;

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then(function (windowClients) {
                for (let i = 0; i < windowClients.length; i++) {
                    const client = windowClients[i];
                    if ('focus' in client) {
                        client.navigate(urlToOpen);
                        return client.focus();
                    }
                }
                if (clients.openWindow) {
                    return clients.openWindow(urlToOpen);
                }
            })
    );
});

// Background Sync — for offline patient data submission
self.addEventListener('sync', event => {
    if (event.tag === 'sync-patient-data') {
        event.waitUntil(
            // Get queued data from IndexedDB and submit to Firebase
            // This is a placeholder for future offline-first capability
            Promise.resolve()
        );
    }
});
