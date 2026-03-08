// ============================================
// AlphaSignal Pro - Firebase Cloud Messaging Service Worker
// Handles Push Notifications in Away Mode
// ============================================

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: "AIzaSyC0vTDfbIwPKUvSH9L_ArwhYS0H48Gt5Yo",
    authDomain: "alphasignal-pro.firebaseapp.com",
    projectId: "alphasignal-pro",
    storageBucket: "alphasignal-pro.firebasestorage.app",
    messagingSenderId: "1038193993643",
    appId: "1:1038193993643:web:383bf3b8911e1df3f114ee"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
    console.log('📱 Push notification recibida:', payload);

    const data = payload.data || {};
    const direction = data.direction || 'SIGNAL';
    const symbol = data.symbol || 'CRYPTO';
    const price = data.price || '';

    const isBuy = direction === 'BUY';

    const notificationTitle = `${isBuy ? '🟢' : '🔴'} ${direction} ${symbol}`;
    const notificationOptions = {
        body: `Precio: $${price} | Fuerza: ${data.strength || 'N/A'}%\n${data.eli5 || 'Señal detectada por AlphaSignal Pro'}`,
        icon: '/assets/icon-192.png',
        badge: '/assets/badge-72.png',
        tag: `signal-${data.id || Date.now()}`,
        requireInteraction: true,
        actions: [
            { action: 'open', title: 'Ver Señal' },
            { action: 'dismiss', title: 'Descartar' }
        ],
        data: {
            url: '/',
            signalId: data.id
        },
        vibrate: isBuy ? [200, 100, 200] : [300, 100, 300, 100, 300]
    };

    return self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    if (event.action === 'open' || !event.action) {
        event.waitUntil(
            clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
                for (const client of clientList) {
                    if (client.url.includes(self.location.origin) && 'focus' in client) {
                        return client.focus();
                    }
                }
                return clients.openWindow('/');
            })
        );
    }
});
