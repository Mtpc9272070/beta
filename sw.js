// sw.js (Service Worker)
const CACHE_NAME = 'aduweb-pwa-v15.7'; // Increment version for new cache
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
  './keyhandler.js',
  // --- Juegos ADUWEB ---
  './adugame_templates.html',
  './carrera_reloj.html',
  './carrera_transporte.html',
  './campo_minado.html',
  './carrusel_carga.html',
  './costimpo.html',
  './duelo_aduanero.html',
  './buscador_documentos.html',
  './identificador_mercancia.html',
  './icogame.html',
  './rompecabezas.html',
  './rompearance.html',
  './rompecabezas_cargos.html',
  './simuinco.html',
  './mapa_mudo.html',
  './customs-enginner.html',
  './customs-impostor-game 2.html',
  './merca-icno.html',
  // --- Simulador Principal ---
  './lamerca.html',
  './sala_espera.html',
  './resultados_partida.html',
  // --- Paneles de Profesor ---
  './panel_control.html',
  './generador_casos.html',
  './creador_juegos.html',
  './mis_juegos.html',
  './editor_planes.html',
  './editor_documentos.html',
  './panel_estadistico.html',
  './resultados_juego_profesor.html',
  // --- Plataforma EMUWEB ---
  './emuweb_intro.html',
  './emuweb_dashboard.html',
  './EMUWEB/emuweb_estudio.html',
  './EMUWEB/emuweb_evaluacion.html',
  './EMUWEB/emuweb_juegos.html',
  './EMUWEB/emuweb_mision_negociacion.html',
  // --- Otros ---
  './tienda.html',
  './biblioteca.html',
  './visor_documento.html',
  './eval_rol.html',
  './level_rol.html',
  './login.html',
  './diseño.html',
  './presentacion.html',
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
  './wrong.mp3', // Coma añadida
  './stamp.mp3',
  './reject.mp3',
  './win.mp3',
  './lose.mp3',
  './swoosh.mp3'
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





