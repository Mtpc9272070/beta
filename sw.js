// sw.js (Service Worker)
const CACHE_NAME = 'aduweb-pwa-v7';
// Lista de archivos críticos que deben guardarse para funcionar offline
const urlsToCache = [
  '/beta/',
  '/beta/index.html',
  '/beta/manifest.json',
  '/beta/sw.js',
  '/beta/costimpo.html',
  '/beta/icogame.html',
  '/beta/rompecabezas.html',
  '/beta/rompearance.html',
  // ... ¡IMPORTANTE: Añade aquí todas las rutas a tus iconos y otros juegos/archivos clave!
  '/beta/logo.png' 
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
