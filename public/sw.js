self.addEventListener('push', function(event) {
    if (event.data) {
        const data = event.data.json();
        const options = {
            body: data.body,
            icon: '/favicon.ico', // Replace with valid icon path
            badge: '/favicon.ico',
            data: {
                url: data.url || '/admin-dashboard.html'
            },
            // Keep notification visible until clicked
            requireInteraction: true 
        };

        if (data.image) {
            options.image = data.image;
        }

        event.waitUntil(
            self.registration.showNotification(data.title || 'New Message', options)
        );
    }
});

self.addEventListener('notificationclick', function(event) {
    console.log('[SW] Notification clicked', event.notification);
    event.notification.close();

    const urlToOpen = (event.notification.data && event.notification.data.url) || '/admin-dashboard.html';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
            // 1. Try to find an existing tab to focus
            for (let i = 0; i < clientList.length; i++) {
                const client = clientList[i];
                // Check if it's the right page (ignoring query params)
                if (client.url && client.url.includes('admin-dashboard.html') && 'focus' in client) {
                    console.log('[SW] Focusing existing tab:', client.url);
                    return client.focus();
                }
            }
            // 2. If no tab found, open a new one
            if (clients.openWindow) {
                console.log('[SW] Opening new window:', urlToOpen);
                return clients.openWindow(urlToOpen);
            }
        })
    );
});
