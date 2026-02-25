const CACHE_NAME = 'nksss-v1';
const urlsToCache = [
    '/',
    '/index.html',
    '/logo.png'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                return cache.addAll(urlsToCache);
            })
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) {
                    return response;
                }
                return fetch(event.request).catch(() => {
                    // Ignore for dynamic firebase calls.
                });
            })
    );
});

self.addEventListener('push', function (event) {
    if (event.data) {
        let payload = { title: "Thông báo", body: "Bạn có thông báo mới.", url: "/" };
        try {
            payload = event.data.json();
        } catch (e) {
            payload.body = event.data.text();
            console.error("Failed to parse push data as JSON", e);
        }

        const options = {
            body: payload.body,
            icon: '/logo.png',
            badge: '/logo.png',
            vibrate: [100, 50, 100],
            data: {
                url: payload.url || "/"
            }
        };

        const title = payload.title || "Sổ tay NKSSS";
        event.waitUntil(
            self.registration.showNotification(title, options)
        );
    }
});

self.addEventListener('notificationclick', function (event) {
    event.notification.close();

    const urlToOpen = event.notification.data.url;

    event.waitUntil(
        clients.matchAll({
            type: 'window',
            includeUncontrolled: true
        }).then(function (windowClients) {
            for (let i = 0; i < windowClients.length; i++) {
                const client = windowClients[i];
                if (client.url.includes('nksss.web.app') && 'focus' in client) {
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
