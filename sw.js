// sw.js (Service Worker)
const CACHE_NAME = 'aduweb-pwa-v11.2'; // Increment version for new cache
// Lista de archivos críticos que deben guardarse para funcionar offline
const urlsToCache = [
  './', // Cache the root path
  './index.html',
  './manifest.json',
  './sw.js',
  './costimpo.html',
  './icogame.html',
  './rompecabezas.html',
  './rompearance.html',
  './sala_espera.html', // Added sala_espera.html
  './lamerca.html',
  './utils.js', // Added utils.js
  './logo.png',
  // Audio files
  './start.mp3',
  './click.mp3',
  './login.mp3',
  './flipcard.mp3',
  './enviar.mp3',
  './time.mp3',
  './tic.mp3',
  './miedo.mp3',
  './poner.mp3',
  './ayuda.mp3',
  './correct.mp3',
  './wrong.mp3',
  './stamp.mp3',
  './reject.mp3'
];

// 1. Instalar el Service Worker y guardar los archivos en caché
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache abierta, agregando archivos.');
        return cache.addAll(urlsToCache);
      })
  );
});

// 2. Recuperar recursos de la caché
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Si el archivo está en caché, lo devuelve
        if (response) {
          return response;
        }
        // Si no está, lo busca en la red
        return fetch(event.request);
      }
    )
  );
});

// 3. Limpiar cachés antiguas al activar una nueva versión
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});