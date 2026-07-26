// sw.js — Service Worker para cache offline
// Registar em cada página: <script>if('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js');</script>

const CACHE_NAME = 'aoda-store-v1';

// Recursos para pré-cache (adicionar conforme necessário)
const PRECACHE_URLS = [
    './',
    './index.html',
    './products.html',
    './cart.html',
    './shared-ux.css',
    './shared-ux.js',
    './resources/favicon.svg'
];

// Instalar — pré-cache dos recursos estáticos
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(PRECACHE_URLS))
            .then(() => self.skipWaiting())
    );
});

// Ativar — limpar caches antigos
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys.filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            )
        ).then(() => self.clients.claim())
    );
});

// Fetch — Network first, fallback para cache
self.addEventListener('fetch', event => {
    // Ignorar requisições não-GET e chamadas Firebase
    if (event.request.method !== 'GET') return;
    if (event.request.url.includes('firebaseio.com') ||
        event.request.url.includes('googleapis.com') ||
        event.request.url.includes('sendgrid.com') ||
        event.request.url.includes('stripe.com')) {
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then(response => {
                // Clonar e guardar no cache
                if (response && response.status === 200) {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseClone);
                    });
                }
                return response;
            })
            .catch(() => {
                // Fallback para cache se offline
                return caches.match(event.request).then(cachedResponse => {
                    if (cachedResponse) return cachedResponse;
                    // Fallback genérico para navegação
                    if (event.request.mode === 'navigate') {
                        return caches.match('./index.html');
                    }
                    return new Response('Offline', { status: 503 });
                });
            })
    );
});