/**
 * Carga un script dinámicamente y devuelve una promesa que se resuelve cuando el script está cargado.
 * @param {string} url La URL del script a cargar.
 * @returns {Promise<void>}
 */
function loadScript(url) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = url;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`Falló la carga del script: ${url}`));
        document.head.appendChild(script);
    });
}

// Función principal que se ejecuta después de cargar todas las dependencias.
async function initializeMapApp() {
    try {
        // Forzar la carga del plugin de curvas y esperar a que termine.
        await loadScript('https://unpkg.com/@elfalem/leaflet-curve@0.9.1/dist/leaflet.curve.js');
    } catch (error) {
        console.error(error);
        alert("No se pudo cargar un componente esencial del mapa (leaflet.curve.js). Las rutas marítimas se verán como líneas rectas.");
    }

    let activeLayers = []; // Para guardar marcadores y rutas

    // Inicializar el mapa una sola vez
    map = L.map('mapContainer').setView([20, 0], 2); // Vista global
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    const PREDEFINED_PORTS = [
        { name: "Shanghai, China", lat: 31.23, lon: 121.47 },
        { name: "Singapore", lat: 1.29, lon: 103.85 },
        { name: "Rotterdam, Netherlands", lat: 51.92, lon: 4.47 },
        { name: "Los Angeles, USA", lat: 33.73, lon: -118.26 },
        { name: "Jebel Ali (Dubai), UAE", lat: 25.02, lon: 55.06 },
        { name: "Busan, South Korea", lat: 35.10, lon: 129.04 },
        { name: "Valparaíso, Chile", lat: -33.04, lon: -71.61 },
        { name: "Cartagena, Colombia", lat: 10.39, lon: -75.51 },
        { name: "Santos, Brazil", lat: -23.96, lon: -46.33 }
    ];

    // Waypoints clave para rutas marítimas realistas
    const WAYPOINTS = {
        PANAMA_CANAL: { lat: 9.08, lon: -79.68, name: "Canal de Panamá" },
        SUEZ_CANAL: { lat: 30.58, lon: 32.53, name: "Canal de Suez" },
        STRAIT_OF_MAGELLAN: { lat: -54, lon: -71, name: "Estrecho de Magallanes" },
        // Waypoint para rodear África
        CAPE_TOWN: { lat: -33.92, lon: 18.42, name: "Cabo de Buena Esperanza" }
    };

    /**
     * Calcula la distancia en línea recta entre dos puntos geográficos usando la fórmula de Haversine.
     * @param {number} lat1 Latitud del punto 1.
     * @param {number} lon1 Longitud del punto 1.
     * @param {number} lat2 Latitud del punto 2.
     * @param {number} lon2 Longitud del punto 2.
     * @returns {number} La distancia en kilómetros.
     */
    function calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Radio de la Tierra en km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = R * c;
        return distance;
    }

    /**
     * Determina si una ruta directa entre dos puntos cruza continentes importantes.
     * Esta es una simplificación y funciona para casos transoceánicos comunes.
     * @param {{lat: number, lng: number}} origin - Punto de origen.
     * @param {{lat: number, lng: number}} dest - Punto de destino.
     * @returns {string|null} 'AMERICAS', 'EURASIA_AFRICA', o null si no cruza.
     */
    function routeCrossesContinent(origin, dest) {
        const lon1 = origin.lng;
        const lon2 = dest.lng;

        // Cruza las Américas (ej. Asia a Europa vía Pacífico)
        const crossesAmericas = (lon1 > 0 && lon2 > 0 && Math.abs(lon1 - lon2) > 180) ||
                                (lon1 < -100 && lon2 > 0) || (lon2 < -100 && lon1 > 0);
        if (crossesAmericas) {
            // Excepción: si ambos puntos están en la costa oeste de América, no es un cruce.
            if (lon1 < -70 && lon2 < -70) return null;
            return 'AMERICAS';
        }

        // Cruza Eurasia/África (ej. América a Asia vía Atlántico)
        const crossesEurasiaAfrica = (lon1 < 0 && lon2 > 0 && (lon2 - lon1) < 180) ||
                                     (lon2 < 0 && lon1 > 0 && (lon1 - lon2) < 180);
        if (crossesEurasiaAfrica) return 'EURASIA_AFRICA';

        return null;
    }

    // Función que lee los datos del panel y actualiza el mapa
    function updateMap() {
        // Limpiar capas anteriores (marcadores, rutas)
        activeLayers.forEach(layer => layer.remove());
        activeLayers = [];

        // Leer datos del panel
        const origin = {
            name: document.getElementById('origin-name').value,
            lat: parseFloat(document.getElementById('origin-lat').value),
            lng: parseFloat(document.getElementById('origin-lon').value) // Leaflet usa 'lng'
        };
        const dest = {
            name: document.getElementById('dest-name').value,
            lat: parseFloat(document.getElementById('dest-lat').value),
            lng: parseFloat(document.getElementById('dest-lon').value) // Leaflet usa 'lng'
        };

        const transportModes = [
            {
                name: document.getElementById('mode1-name').value,
                cost: document.getElementById('mode1-cost').value,
                time: document.getElementById('mode1-time').value,
                color: document.getElementById('mode1-color').value
            },
            {
                name: document.getElementById('mode2-name').value,
                cost: document.getElementById('mode2-cost').value,
                time: document.getElementById('mode2-time').value,
                color: document.getElementById('mode2-color').value
            }
        ];

        // Dibujar nuevos elementos
        const originMarker = L.marker([origin.lat, origin.lng]).addTo(map)
            .bindPopup(`<b>Origen:</b><br>${origin.name}`);
        const destMarker = L.marker([dest.lat, dest.lng]).addTo(map)
            .bindPopup(`<b>Destino:</b><br>${dest.name}`);
        
        activeLayers.push(originMarker, destMarker);

        // Calcular y mostrar la distancia
        const distance = calculateDistance(origin.lat, origin.lng, dest.lat, dest.lng);
        const distanceDisplay = document.getElementById('route-distance');
        distanceDisplay.textContent = `${distance.toFixed(0).toLocaleString()} km`;

        transportModes.forEach(mode => {
            let routeLine;
            // Diferenciar el dibujo de la ruta
            if (mode.name.toLowerCase().includes('aéreo')) {
                // Ruta aérea: línea recta y discontinua
                routeLine = L.polyline([[origin.lat, origin.lng], [dest.lat, dest.lng]], {
                    color: mode.color,
                    weight: 3,
                    opacity: 0.9,
                    dashArray: '8, 8' // Línea discontinua
                }).addTo(map);
            } else {
                // --- LÓGICA DE RUTA MARÍTIMA CON FALLBACK ---
                // Primero, verificar si el plugin de curvas está cargado.
                if (typeof L.curve === 'function') {
                    // Lógica de waypoints inteligentes mejorada
                    const routePoints = [[origin.lat, origin.lng]];
                    const continentCrossed = routeCrossesContinent(origin, dest);

                    if (continentCrossed) {
                        // Si cruza un continente, decidir qué canal usar.
                        const distToPanama = calculateDistance(origin.lat, origin.lng, WAYPOINTS.PANAMA_CANAL.lat, WAYPOINTS.PANAMA_CANAL.lon);
                        const distToSuez = calculateDistance(origin.lat, origin.lng, WAYPOINTS.SUEZ_CANAL.lat, WAYPOINTS.SUEZ_CANAL.lon);

                        if (continentCrossed === 'AMERICAS') {
                            // Si el destino está muy al sur, usar Magallanes, si no, Panamá.
                            if (dest.lat < -25) { // Umbral de latitud para la decisión
                                routePoints.push([WAYPOINTS.STRAIT_OF_MAGELLAN.lat, WAYPOINTS.STRAIT_OF_MAGELLAN.lon]);
                            } else {
                                routePoints.push([WAYPOINTS.PANAMA_CANAL.lat, WAYPOINTS.PANAMA_CANAL.lon]);
                            }
                        } else if (continentCrossed === 'EURASIA_AFRICA') {
                            routePoints.push([WAYPOINTS.SUEZ_CANAL.lat, WAYPOINTS.SUEZ_CANAL.lon]);
                        } else if (distToPanama < distToSuez) {
                            routePoints.push([WAYPOINTS.PANAMA_CANAL.lat, WAYPOINTS.PANAMA_CANAL.lon]);
                        } else {
                            routePoints.push([WAYPOINTS.SUEZ_CANAL.lat, WAYPOINTS.SUEZ_CANAL.lon]);
                        }
                    }

                    routePoints.push([dest.lat, dest.lng]);

                    // Dibujar una curva para cada segmento de la ruta
                    for (let i = 0; i < routePoints.length - 1; i++) {
                        const start = routePoints[i];
                        const end = routePoints[i+1];
                        const segmentCurve = L.curve(['M', start, 'Q', getControlPoint(start, end), end], { color: mode.color, weight: 4, opacity: 0.8 });
                        
                        if (i === 0) routeLine = segmentCurve; // Asignar el primer segmento para el popup
                        segmentCurve.addTo(map);
                        activeLayers.push(segmentCurve);
                    }
                } else {
                    // Fallback: Si L.curve no está disponible, dibujar una línea recta simple.
                    console.warn("L.curve no está disponible. Dibujando línea recta como fallback para la ruta marítima.");
                    routeLine = L.polyline([[origin.lat, origin.lng], [dest.lat, dest.lng]], { color: mode.color, weight: 4, opacity: 0.8 }).addTo(map);
                }
            }

            if (routeLine) {
                routeLine.bindPopup(`
                    <strong>${mode.name}</strong><br>
                    Costo: $${parseInt(mode.cost).toLocaleString()}<br>
                    Tiempo: ${mode.time} días
                    <hr style="margin: 4px 0;"><span style="color: #ccc;">Distancia: ~${distance.toFixed(0).toLocaleString()} km</span>
                `);
                if (!activeLayers.includes(routeLine)) {
                    activeLayers.push(routeLine);
                }
            }
        });

        // Ajustar el mapa para que muestre ambos marcadores
        const bounds = L.latLngBounds([origin.lat, origin.lng], [dest.lat, dest.lng]);
        map.fitBounds(bounds, { padding: [50, 50] }); // Añadir padding para que no estén en el borde
    }

    /**
     * Calcula un punto de control para una curva de Bézier entre dos puntos.
     * La nueva lógica fuerza la curva a "arquearse" hacia el ecuador para simular
     * una ruta oceánica y evitar cruzar continentes en la mayoría de los casos.
     */
    function getControlPoint(start, end) {
        const midLat = (start[0] + end[0]) / 2;
        const midLng = (start[1] + end[1]) / 2;

        // Vector perpendicular a la línea recta entre start y end
        const offsetX = start[0] - end[0];
        const offsetY = end[1] - start[1];

        // Intensidad de la curva, puede ser ajustada
        const curveIntensity = 0.3;

        // Determinar la dirección de la curva. Si el punto medio está en el hemisferio norte,
        // la curva va hacia el sur (hacia el ecuador), y viceversa.
        const direction = midLat > 0 ? -1 : 1;
        const controlLat = midLat + direction * offsetY * curveIntensity;
        const controlLng = midLng + direction * offsetX * curveIntensity;

        return [controlLat, controlLng];
    }

    /**
     * Busca las coordenadas de una ubicación por su nombre y actualiza el mapa.
     * @param {HTMLInputElement} nameInput - El campo de input del nombre.
     * @param {HTMLInputElement} latInput - El campo de input de la latitud.
     * @param {HTMLInputElement} lonInput - El campo de input de la longitud.
     */
    async function geocodeAndUpdatemap(nameInput, latInput, lonInput) {
        const query = nameInput.value.trim();
        if (!query) return;

        // Feedback visual: Inicia la búsqueda
        nameInput.classList.add('is-searching');

        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;

        try {
            const response = await fetch(url);
            const data = await response.json();

            if (data && data.length > 0) {
                const location = data[0];
                latInput.value = parseFloat(location.lat).toFixed(4);
                lonInput.value = parseFloat(location.lon).toFixed(4);
                
                // Una vez actualizados los inputs, llamamos a la función principal de redibujado.
                updateMap();
            } else {
                alert(`No se encontraron coordenadas para "${query}".`);
            }
        } catch (error) {
            console.error("Error de geocodificación:", error);
            alert("Hubo un error al contactar el servicio de mapas.");
        } finally {
            // Feedback visual: Termina la búsqueda
            nameInput.classList.remove('is-searching');
        }
    }

    /**
     * Rellena los menús desplegables con los puertos predefinidos.
     */
    function populatePortSelectors() {
        const originSelect = document.getElementById('origin-select');
        const destSelect = document.getElementById('dest-select');

        PREDEFINED_PORTS.forEach((port, index) => {
            const option = new Option(`${port.name}`, index);
            originSelect.add(option.cloneNode(true));
            destSelect.add(option);
        });

        originSelect.addEventListener('change', (e) => {
            if (e.target.value === "") return;
            const port = PREDEFINED_PORTS[e.target.value];
            document.getElementById('origin-name').value = port.name;
            document.getElementById('origin-lat').value = port.lat;
            document.getElementById('origin-lon').value = port.lon;
            updateMap();
        });

        destSelect.addEventListener('change', (e) => {
            if (e.target.value === "") return;
            const port = PREDEFINED_PORTS[e.target.value];
            document.getElementById('dest-name').value = port.name;
            document.getElementById('dest-lat').value = port.lat;
            document.getElementById('dest-lon').value = port.lon;
            updateMap();
        });
    }

    // --- LÓGICA DE LA INTERFAZ (CORREGIDA) ---

    // Lista de todos los campos de entrada que deben provocar una actualización del mapa.
    const updateTriggers = [
        'origin-name', 'origin-lat', 'origin-lon',
        'dest-name', 'dest-lat', 'dest-lon',
        'mode1-name', 'mode1-cost', 'mode1-time', 'mode1-color',
        'mode2-name', 'mode2-cost', 'mode2-time', 'mode2-color'
    ];
    
    // Asignar los listeners a todos los campos de entrada.
    // Usamos tanto 'input' (para cambios en tiempo real al escribir) como 'change' (para clics en flechas de números).
    updateTriggers.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('input', updateMap);
            element.addEventListener('change', updateMap);
        }
    });

    // Listeners específicos para la búsqueda por nombre
    document.getElementById('origin-name').addEventListener('change', () => {
        geocodeAndUpdatemap(document.getElementById('origin-name'), document.getElementById('origin-lat'), document.getElementById('origin-lon'));
    });
    document.getElementById('dest-name').addEventListener('change', () => {
        geocodeAndUpdatemap(document.getElementById('dest-name'), document.getElementById('dest-lat'), document.getElementById('dest-lon'));
    });

    // Poblar los selectores de puertos
    populatePortSelectors();

    // Dibujar el estado inicial del mapa al cargar la página
    updateMap();
}
// Iniciar la aplicación después de que el DOM esté listo.
document.addEventListener('DOMContentLoaded', () => {
    initializeMapApp();

    // --- LÓGICA DEL PANEL COLAPSABLE ---
    const appContainer = document.getElementById('app');
    const toggleBtn = document.getElementById('panel-toggle-btn');
    const orientationBtn = document.getElementById('orientation-toggle-btn');

    // Comprobar si el panel debe estar colapsado por defecto (definido en CSS)
    const initialPanelState = getComputedStyle(appContainer).getPropertyValue('--initial-panel-state').trim();
    if (initialPanelState === "'collapsed'") {
        appContainer.classList.add('panel-collapsed');
        toggleBtn.textContent = '›';
    }

    toggleBtn.addEventListener('click', () => {
        appContainer.classList.toggle('panel-collapsed');
        const isCollapsed = appContainer.classList.contains('panel-collapsed');
        toggleBtn.textContent = isCollapsed ? '›' : '‹';
        // Dar tiempo a la animación CSS y luego invalidar el tamaño del mapa
        setTimeout(() => {
            if (window.map) window.map.invalidateSize();
        }, 300);
    });

    // --- LÓGICA DE CAMBIO DE ORIENTACIÓN ---
    orientationBtn.addEventListener('click', () => {
        appContainer.classList.toggle('horizontal-layout');
        // Dar tiempo a la animación CSS y luego invalidar el tamaño del mapa
        setTimeout(() => {
            if (window.map) window.map.invalidateSize();
        }, 300);
    });
});
