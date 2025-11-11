// sw.js (Service Worker)
const CACHE_NAME = 'aduweb-pwa-v16'; // Increment version for new cache
// Lista de archivos críticos que deben guardarse para funcionar offline
const urlsToCache = [
  './', // Cache the root path
  './index.html',
  './config.js',
  './utils.js',
  './manifest.json',
  './sw.js',
  './logo.html',
  './logo.png',
  './adupost.html',
  './adupost_html',
  './adutools.html',
  './role_dashboard.html',
  './estacion_clasificacion.html', // <-- AÑADIDO
  './sala_multijugador.html',
  './sipu_simulator.html',
  './yarvis-improved.js',
  './js/main.js',
  './sipu/3d/js/simu_cargas.js',
  './sipu/3d/js/simu_especificaciones.js',
  './mapa_logistico.js',
];