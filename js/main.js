import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.11/firebase-app.js"; // Firebase App (core)
import { getDatabase, ref, get, update, onValue, off, set } from "https://www.gstatic.com/firebasejs/9.6.11/firebase-database.js"; // Firebase Realtime Database
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.11/firebase-auth.js"; // Firebase Auth
import { playSound } from "../utils.js";
import { firebaseConfig, CAREER_ROLES, LEVELS, calculateLevel } from "../config.js"; // MODIFICADO: Importar sistema de niveles

// --- CONSTANTES Y VARIABLES GLOBALES ---
const SESSION_KEY = 'aduweb_player_name';
const SESSION_KEY_ID = 'aduweb_player_key';
const SESSION_KEY_CAREER = 'aduweb_career';
const SESSION_KEY_CAREER_NAME = 'aduweb_career_name';
const TOTAL_MODULES_REQUIRED = 5; // Para la barra de progreso

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

let currentUserKey = null;
let playerNameGlobal = "";
let currentCareerId = null;
let currentCareerName = null;
let notificationsListener = null;
let userProfileListener = null;
let processedNotifications = new Set();
let deferredPrompt; // Variable para guardar el evento de instalación
let pendingJoinRoomId = null; // NUEVO: Variable para guardar invitación

const views = {
    login: document.getElementById('login-view'),
    role: document.getElementById('role-view'),
    dashboard: document.getElementById('dashboard-view'),
    ranking: document.getElementById('ranking-view'),
};
const navButtons = {
    dashboard: document.getElementById('nav-dashboard'),
    role: document.getElementById('nav-role'),
    ranking: document.getElementById('nav-ranking')
};

// --- NUEVO: Lógica de Bloqueo de Secciones (BLOQUEO ELIMINADO) ---
function checkSectionLocks(trainingProgress, tickets) {
    // --- ACCESO LIBRE ---
    // Se eliminan las comprobaciones de progreso y tiquetes. Las secciones siempre estarán desbloqueadas.
    const practiceCard = document.getElementById('practice-games-card');
    const practiceLock = document.getElementById('practice-games-lock-overlay');
    if (practiceLock) practiceLock.classList.add('hidden');

    const onlineCard = document.getElementById('online-match-card');
    const onlineLock = document.getElementById('online-match-lock-overlay');
    if (onlineLock) onlineLock.classList.add('hidden');
}
let ticketTimerInterval = null;
function updateTicketTimer(activeTicket) {
    const timerIcon = document.getElementById('ticket-timer-icon');
    const timeLeftSpan = document.getElementById('ticket-time-left');

    if (ticketTimerInterval) clearInterval(ticketTimerInterval);

    if (activeTicket) {
        timerIcon.classList.remove('hidden');
        
        const update = () => {
            const now = Date.now();
            const remainingMs = activeTicket.expiresAt - now;

            if (remainingMs <= 0) {
                timerIcon.classList.add('hidden');
                clearInterval(ticketTimerInterval);
                return;
            }

            const hours = Math.floor(remainingMs / (1000 * 60 * 60));
            const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
            timeLeftSpan.textContent = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}h`;
        };
        update();
        ticketTimerInterval = setInterval(update, 60000); // Actualizar cada minuto
    } else {
        timerIcon.classList.add('hidden');
    }
}

// ----------------------------------------------------------------------
// 🚀 INICIO DE SESIÓN Y RUTAS
// ----------------------------------------------------------------------

// Función central para cargar datos y decidir la ruta (Login/Selección/Dashboard)
function loadUserDataAndRoute(data) {
    playerNameGlobal = data.nombre;
    currentUserKey = data.key;            

    // --- ¡NUEVO! CÁLCULO DE ROL BASADO EN XP ---
    const userXP = data.puntaje || 0;
    const levelInfo = calculateLevel(userXP); // Usamos la función importada de config.js
    currentCareerName = levelInfo.title; // El rol ahora es el título del nivel
    // Ya no se guarda el rol en localStorage, siempre se calcula.

    // --- LÓGICA DE CÁLCULO DE PROGRESO (Restaurada de logo.html) ---
    const totalScore = data.puntaje || 0; // Se actualiza en el listener
    const missionsCompleted = data.misiones_completadas || 0;
    const gameHistory = data.gameHistory ? Object.values(data.gameHistory) : [];
    
    document.getElementById("playerScore").textContent = totalScore;
    document.getElementById("playerProgress").textContent = `${missionsCompleted}`;
    document.getElementById("user-score").textContent = `${totalScore} Puntos`; // Header

    const avgScore = missionsCompleted > 0 ? Math.round(totalScore / missionsCompleted) : 0;
    document.getElementById("playerAvgScore").textContent = avgScore;

    const trainingProgress = data.progreso_entrenamiento || 0;
    const trainingProgressBar = document.getElementById("training-progress-bar");
    // Actualizar también la barra de perfil
    const profileTrainingBar = document.getElementById("profile-training-bar");
    if(profileTrainingBar) { profileTrainingBar.style.width = `${trainingProgress}%`; profileTrainingBar.textContent = `${Math.round(trainingProgress)}%`; }

    if(trainingProgressBar) trainingProgressBar.style.width = `${trainingProgress}%`;

    // --- ¡NUEVO! Lógica de desbloqueo de secciones ---
    checkSectionLocks(data.progreso_entrenamiento, data.tickets);


    const lastActivityContainer = document.getElementById("lastActivityContainer");
    if (lastActivityContainer && gameHistory.length > 0) {
        const lastGame = gameHistory.sort((a, b) => b.date - a.date)[0];
        const gameDate = new Date(lastGame.date).toLocaleDateString();
        const resultClass = lastGame.result === 'success' ? 'text-green-600' : 'text-red-600';
        lastActivityContainer.innerHTML = `
            <p class="text-lg text-gray-700">Simulación en sala <strong class="font-mono">${lastGame.roomId}</strong>.</p>
            <p class="text-sm mt-1">Finalizada el ${gameDate} con un puntaje de <strong class="text-blue-700">${lastGame.score}</strong> pts.</p>
            <p class="text-sm font-semibold ${resultClass} mt-2">Resultado: ${lastGame.result.toUpperCase()}</p>
        `;
    }

    // --- FIN DE LÓGICA DE PROGRESO ---

    // El avatar se actualiza en el listener de perfil

    // Decide la ruta
    // Ya no se necesita la selección de rol, siempre va al dashboard
    showMainDashboard();

    document.getElementById('main-content').classList.remove('hidden');
    // Iniciar la escucha de notificaciones y perfil (función unificada)
    startListeningForProfileAndNotifications(currentUserKey);
}


// 📥 LOGIN (Actualizado con SweetAlert2)
async function login() {
    const userName = document.getElementById("userName").value.trim().toLowerCase();
    if (!userName) {
        Swal.fire({
            title: '¡Espera!',
            text: 'Ingresa tu primer nombre para continuar.',
            icon: 'warning',
            confirmButtonColor: '#f59e0b'
        });
        return;
    }

    // ¡CORRECCIÓN! Reproducir un sonido aquí, después de la interacción del usuario.
    playSound("soundLogin");

    const loginBtn = document.querySelector('#login-view button'); // Asegurarse de que el selector es correcto
    loginBtn.textContent = 'Buscando...';

    // 1. Verificar si es un usuario especial (profesor)
    const specialUserRef = ref(db, "userEspecial");
    const specialSnapshot = await get(specialUserRef);
    if (specialSnapshot.exists()) {
        let specialUserFound = null;
        specialSnapshot.forEach(child => {
            const data = child.val();
            if ((data.nombre || "").toLowerCase() === userName) {
                specialUserFound = data;
            }
        });
        if (specialUserFound) {
            localStorage.setItem('aduweb_special_user_name', specialUserFound.nombre);
            window.location.href = 'panel_control.html'; // Redirección limpia
            return;
        }
    }

    try {
        const snapshot = await get(ref(db, "usuarios"));
        if (snapshot.exists()) {
            let encontrado = null;
            snapshot.forEach((child) => {
                const data = child.val();
                const nombreBD = (data.nombre || "").toLowerCase();
                if (nombreBD.includes(userName)) {
                    encontrado = { key: child.key, ...data };
                }
            });

            if (encontrado) {
                localStorage.setItem(SESSION_KEY, encontrado.nombre);
                localStorage.setItem(SESSION_KEY_ID, encontrado.key);

                // NUEVO: Inicializar AduCoins si no existen
                if (typeof encontrado.aducoins === 'undefined') {
                    encontrado.aducoins = 100; // Valor inicial
                    await set(ref(db, `usuarios/${encontrado.key}/aducoins`), 100);
                }

                loadUserDataAndRoute(encontrado);
                playSound("soundLogin");
                
                // Nueva Alerta Animada (¡Éxito!)
                Swal.fire({
                    title: `¡Bienvenido, ${encontrado.nombre.split(' ')[0]}!`,
                    text: `Tu rol de simulación actual es: ${currentCareerName || 'Sin asignar (Elige tu rol)'}.`, // MODIFICADO: Usar currentCareerName
                    icon: 'success', 
                    confirmButtonText: 'Continuar',
                    confirmButtonColor: '#10b981', // green-600
                });

                // NUEVO: Si hay una invitación pendiente, ir a la sala multijugador.
                if (pendingJoinRoomId) {
                    window.location.href = `sala_multijugador.html?matchId=${pendingJoinRoomId}`;
                    return; // Evitar la redirección normal
                }


            } else {
                // Nueva Alerta Animada (¡Error!)
                Swal.fire({
                    title: 'Error de Acceso',
                    text: 'Usuario no encontrado en la base de datos.',
                    icon: 'error',
                    confirmButtonText: 'Entendido',
                    confirmButtonColor: '#ef4444' // red-500
                });
            }
        } else {
            Swal.fire({
                title: 'Error de BD',
                text: 'No se encontraron usuarios en la base de datos.',
                icon: 'error',
                confirmButtonColor: '#ef4444'
            });
        }
    } catch(e) {
        console.error(e);
        Swal.fire({
            title: 'Error de Conexión',
            text: 'Hubo un problema al conectar con Firebase.',
            icon: 'error',
            confirmButtonColor: '#ef4444'
        });
    } finally {
        loginBtn.disabled = false;
        loginBtn.textContent = 'Entrar';
    }
}

// Función para obtener datos de Firebase por una clave específica
async function getPlayerByKey(key) {
     try {
        const snapshot = await get(ref(db, `usuarios/${key}`));
        if (snapshot.exists()) {
            return { key: snapshot.key, ...snapshot.val() };
        }
        return null;
    } catch (error) {
        console.error("Error al obtener jugador por clave:", error);
        return null;
    }
}

// 🔍 CHECK SESSION (FUNCIÓN OPTIMIZADA Y CORREGIDA)
async function checkSession() {
    const savedKey = localStorage.getItem(SESSION_KEY_ID);
    
    // --- NUEVO: Procesar invitación desde URL ANTES de verificar la sesión ---
    const urlParams = new URLSearchParams(window.location.search);
    const matchIdToJoin = urlParams.get('joinRoomId');
    if (matchIdToJoin) {
        pendingJoinRoomId = matchIdToJoin.toUpperCase();
        // Limpiar la URL para no procesarla de nuevo si el usuario recarga
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    // 1. Si no hay clave en localStorage, es un usuario nuevo. Mostramos el login.
    if (!savedKey) {
        const loadingScreen = document.getElementById('loading-screen');
        loadingScreen.classList.add('opacity-0');
        setTimeout(() => {
            loadingScreen.classList.add('hidden');
            document.getElementById('main-content').classList.remove('hidden');
            navigate("login");
            // Si hay una invitación pendiente y no hay sesión, mostramos un aviso
            if (pendingJoinRoomId) {
                Swal.fire('Invitación Detectada', `Inicia sesión para unirte a la sala ${pendingJoinRoomId}.`, 'info');
            }
        }, 500);
        return;
    }

    // 2. Si hay clave, intentamos recuperar el perfil desde Firebase.
    document.getElementById('loading-text').textContent = 'Recuperando sesión...';
    const playerStatus = await getPlayerByKey(savedKey);
    
    if (playerStatus) {
        document.getElementById('main-content').classList.remove('hidden');
        currentUserKey = savedKey; // Establecer la clave global del usuario
        
        // --- LÓGICA DE RECONEXIÓN MEJORADA ---
        // OPTIMIZADO: Leemos directamente del perfil del usuario si está en una partida.
        const activeMatchId = playerStatus.activeMatch;

        if (activeMatchId) {
            const reconectResult = await Swal.fire({
                title: '¡Partida en Curso Detectada!',
                text: `Parece que tienes una partida activa en la sala "${activeMatchId}". ¿Deseas reconectarte?`,
                icon: 'info',
                showCancelButton: true,
                confirmButtonColor: '#10b981',
                cancelButtonColor: '#ef4444',
                confirmButtonText: 'Sí, ¡Reconectar!',
                cancelButtonText: 'No, abandonar partida'
            });

            if (reconectResult.isConfirmed) {
                // Redirigimos a la sala de espera, que ya sabe cómo manejar la reconexión.
                window.location.href = `sala_espera.html`;
                return;
            } else {
                // El usuario no quiere reconectar, limpiamos su estado de partida activa.
                const userRef = ref(db, `usuarios/${savedKey}/activeMatch`);
                await set(userRef, null);
            }
        }

        // --- NUEVO: Si hay una invitación pendiente y el usuario YA tiene sesión ---
        if (pendingJoinRoomId) {
            // Redirigir directamente a la sala de la invitación
            window.location.href = `sala_multijugador.html?matchId=${pendingJoinRoomId}`;
            return; // Detener el flujo normal para que la redirección ocurra
        }

        // --- FLUJO NORMAL (SI NO HAY PARTIDA ACTIVA O SE ABANDONÓ) ---
            document.getElementById('main-content').classList.remove('hidden');
        loadUserDataAndRoute(playerStatus);

    } else {
        document.getElementById('main-content').classList.remove('hidden');
        // El usuario existía antes, pero su clave ya no es válida o hay un error de conexión
        localStorage.removeItem(SESSION_KEY);
        localStorage.removeItem(SESSION_KEY_ID);
        // El usuario es inválido, lo mandamos a login.
        navigate("login");
        
        Swal.fire('Error de Conexión', 'No se pudo cargar tu perfil. Por favor, inicia sesión de nuevo.', 'error');
    }

    document.getElementById('loading-screen').classList.add('opacity-0');
    setTimeout(() => {
        document.getElementById('loading-screen').classList.add('hidden');
    }, 500);
}

// ----------------------------------------------------------------------
// 🔄 FUNCIONES DE VISTAS (SCREEN SWITCHING)
// ----------------------------------------------------------------------

function navigate(targetViewId) {
    Object.values(views).forEach(view => view.classList.add('hidden'));
    if (navButtons[targetViewId]) Object.values(navButtons).forEach(btn => btn.classList.remove('nav-active'));

    if (views[targetViewId]) {
        views[targetViewId].classList.remove('hidden');
        views[targetViewId].classList.add('animate-fade-in');
        if (navButtons[targetViewId]) {
            navButtons[targetViewId].classList.add('nav-active');
        }
    }
}

function showMainDashboard() {
    document.getElementById("playerName").textContent = playerNameGlobal;
    document.getElementById("currentRoleDisplay").textContent = currentCareerName || "Estudiante de primer semestre";
    navigate('dashboard');
}

function selectCareer(careerId, careerName) {
    localStorage.setItem(SESSION_KEY_CAREER, careerId);
    localStorage.setItem(SESSION_KEY_CAREER_NAME, careerName);
    currentCareerId = careerId;
    currentCareerName = careerName;
    showMainDashboard();
}

async function viewRanking() {
    playSound('soundClick');
    const snapshot = await get(ref(db, "usuarios"));
    const fullListContainer = document.getElementById('full-ranking-list');
    fullListContainer.innerHTML = '';

    if (snapshot.exists()) {
        let ranking = [];
        snapshot.forEach((child) => {
            const data = child.val();
            if (data.nombre) {
                ranking.push({ uid: child.key, nombre: data.nombre, puntaje: data.puntaje || 0 });
            }
        });

        ranking.sort((a, b) => b.puntaje - a.puntaje);

        ranking.forEach((player, i) => {
            const isCurrentUser = player.uid === currentUserKey;
            const baseClasses = "flex justify-between items-center py-3 border-b border-gray-100 rounded-lg px-2";
            const userClasses = isCurrentUser ? " bg-green-100 font-bold" : "";
            const userNickname = isCurrentUser ? `Tú (${player.nombre})` : player.nombre;
            const scoreColor = isCurrentUser ? 'text-yellow-700' : 'text-yellow-600';
            const rankColor = i === 0 ? 'text-blue-500' : i === 1 ? 'text-green-500' : i === 2 ? 'text-red-500' : 'text-gray-500';

            const html = `
                <div class="${baseClasses + userClasses}">
                    <div class="flex items-center">
                        <span class="text-2xl font-extrabold ${rankColor} mr-4 w-6 text-center">#${i + 1}</span>
                        <div class="w-8 h-8 ${isCurrentUser ? 'bg-green-600' : 'bg-gray-200'} rounded-full mr-2"></div>
                        <span class="font-medium ${isCurrentUser ? 'text-gray-900' : 'text-gray-700'}">${userNickname}</span>
                    </div>
                    <span class="text-lg font-bold ${scoreColor}">${player.puntaje} pts</span>
                </div>
            `;
            fullListContainer.insertAdjacentHTML('beforeend', html);
        });
    }
    navigate('ranking');
}

async function logout() {
    playSound('soundClick');
    if (userProfileListener) userProfileListener();
    if (notificationsListener) notificationsListener();
    localStorage.removeItem(SESSION_KEY_ID);
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_KEY_CAREER);
    localStorage.removeItem(SESSION_KEY_CAREER_NAME);
    Swal.fire({ title: 'Sesión Cerrada', icon: 'info', timer: 1500, showConfirmButton: false });
    setTimeout(() => navigate('login'), 1500);
}

// ----------------------------------------------------------------------
// 🔔 NUEVO: LÓGICA DE NOTIFICACIONES
// ----------------------------------------------------------------------

// NUEVO: Función para generar iniciales a partir de un nombre
function getInitials(name) {
    if (!name) return '??';
    const nameParts = name.trim().split(' ');
    if (nameParts.length > 1) {
        return (nameParts[0][0] + nameParts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
}

function startListeningForProfileAndNotifications(playerKey) {
    // --- Listener de Notificaciones ---
    if (notificationsListener) {
        notificationsListener(); // Llama a la función de desuscripción.
        notificationsListener = null;
    }
    processedNotifications.clear();
    let isFirstLoad = true;

    const notificationsRef = ref(db, `usuarios/${playerKey}/notificaciones`);
    notificationsListener = onValue(notificationsRef, (snapshot) => {
        const notifications = snapshot.val();
        renderNotifications(notifications);

        if (notifications) {
            Object.keys(notifications).forEach(key => {
                if (!processedNotifications.has(key)) {
                    // Es una notificación nueva
                    processedNotifications.add(key);
                    if (!isFirstLoad) {
                        // Mostrar alerta solo si no es la carga inicial
                        const notif = notifications[key];
                        if (notif.tipo === 'INVITACION_SALA' && !notif.leido) {
                            Swal.fire({
                                toast: true,
                                position: 'top-end',
                                icon: 'info',
                                title: `¡Nueva invitación de ${notif.remitente_nombre}!`,
                                html: `Te ha invitado a la sala <strong>${notif.id_sala}</strong>.`,
                                showConfirmButton: true,
                                confirmButtonText: 'Unirse',
                                timer: 4000, // 4 segundos
                                timerProgressBar: true,
                            }).then((result) => { if (result.isConfirmed) { acceptInvitation(key, notif.id_sala); } });
                        } else if (notif.tipo === 'NUEVO_ADUPOST' && !notif.leido) {
                            Swal.fire({
                                toast: true,
                                position: 'top-end',
                                icon: 'info',
                                title: `¡Nuevo post de ${notif.remitente_nombre}!`,
                                html: `<em>"${notif.post_content}"</em>`,
                                showConfirmButton: false,
                                timerProgressBar: true,
                            }).then((result) => { if (result.isConfirmed) { acceptInvitation(key, notif.id_sala); } });
                            // NUEVO: Animar la campana
                            const bell = document.getElementById('notification-bell');
                            if (bell) {
                                bell.style.animation = 'ring-bell 0.8s ease-in-out';
                                setTimeout(() => bell.style.animation = '', 800);
                            }
                        }
                    }
                }
            });
        }
        isFirstLoad = false; // Después de la primera ejecución, ya no es la carga inicial
    });

    // --- Listener de Perfil (Avatar y datos) ---
    if (userProfileListener) userProfileListener();
    const profileRef = ref(db, `usuarios/${playerKey}`);

    userProfileListener = onValue(profileRef, (snapshot) => {
        if (snapshot.exists()) {
            const userData = snapshot.val();
            // MODIFICADO: Actualizar avatar en el header con iniciales
            const profileButton = document.getElementById('profile-button');
            profileButton.innerHTML = getInitials(userData.nombre);
            
            // Actualizar datos en la vista de perfil
            updateProfileView(userData);
        }
    });
}

// NUEVO: Función para marcar notificación como leída y redirigir
async function handleNotificationClick(notificationKey, url, event) {
    if (event) event.preventDefault(); // Prevenir la navegación por defecto del enlace

    if (!currentUserKey || !notificationKey) {
        if (url) window.location.href = url;
        return;
    }
    const notifRef = ref(db, `usuarios/${currentUserKey}/notificaciones/${notificationKey}/leido`);
    await set(notifRef, true);
    // La redirección se hace después de marcar como leída
    if (url) window.location.href = url; 
}

function renderNotifications(notifications) {
    const panel = document.getElementById('notification-list');
    const badge = document.getElementById('notification-badge');
    if (!panel || !badge) return;

    if (!notifications) {
        panel.innerHTML = '<p class="p-4 text-sm text-gray-500 text-center">No tienes notificaciones.</p>';
        badge.classList.add('hidden');
        return;
    }

    const notificationKeys = Object.keys(notifications).sort((a, b) => notifications[b].fecha - notifications[a].fecha);
    let unreadCount = 0;
    let html = '';

    notificationKeys.forEach(key => {
        const notif = notifications[key];
        if (!notif.leido) unreadCount++;

        if (notif.tipo === 'INVITACION_SALA') {
            html += `
                <div onclick="handleNotificationClick('${key}', null)" class="p-3 border-b hover:bg-gray-50 ${notif.leido ? 'opacity-60' : ''}">
                    <p class="text-sm text-gray-800">
                        <strong>${notif.remitente_nombre}</strong> te ha invitado a la sala <strong class="font-mono">${notif.id_sala}</strong>.
                    </p>
                    <div class="mt-2 text-right">
                        <button onclick="event.stopPropagation(); acceptInvitation('${key}', '${notif.id_sala}')" class="text-xs bg-green-500 text-white font-semibold px-3 py-1 rounded-md hover:bg-green-600">
                            Aceptar
                        </button>
                    </div>
                </div>
            `;
        }
        // NUEVO: Renderizar notificaciones de nuevos documentos
        else if (notif.tipo === 'NUEVO_DOCUMENTO') {
            const url = `visor_documento.html?id=${notif.id_documento}`;
            html += `
                <a href="${url}" onclick="handleNotificationClick('${key}', '${url}', event)" data-notif-key="${key}" class="notification-item block p-3 border-b hover:bg-gray-50 ${notif.leido ? 'opacity-60' : ''}">
                    <p class="text-sm text-gray-800"><strong class="text-cyan-600">Biblioteca:</strong> Se ha añadido el documento: <strong>${notif.titulo_documento}</strong>.</p>
                </a>
            `;
        }
        // NUEVO: Renderizar notificaciones de AduPost
        else if (notif.tipo === 'NUEVO_ADUPOST') {
            // MODIFICADO: Ahora usa handleNotificationClick
            const url = `adupost.html?post=${notif.postKey}`;
            html += `
                <a href="${url}" onclick="handleNotificationClick('${key}', '${url}', event)" data-notif-key="${key}" class="notification-item block p-3 border-b hover:bg-gray-50 ${notif.leido ? 'opacity-60' : ''}"><p class="text-sm text-gray-800"><strong class="text-green-600">AduPost:</strong> <strong>${notif.remitente_nombre || 'Usuario'}</strong> publicó: <em>"${notif.post_content || 'nuevo contenido'}"</em></p></a>
            `;
        } else if (notif.tipo === 'NUEVA_REACCION') {
            // NUEVO: Renderizar notificaciones de reacción
            // MODIFICADO: Ahora usa handleNotificationClick
            const url = `adupost.html?post=${notif.postKey}`;
            html += `
                <a href="${url}" onclick="handleNotificationClick('${key}', '${url}', event)" data-notif-key="${key}" class="notification-item block p-3 border-b hover:bg-gray-50 ${notif.leido ? 'opacity-60' : ''}"><p class="text-sm text-gray-800"><strong class="text-green-600">AduPost:</strong> <strong>${notif.remitente_nombre || 'Alguien'}</strong> reaccionó a tu publicación: <em>"${notif.post_content || ''}"</em></p></a>
            `;
        }
        // NUEVO: Renderizar notificaciones de bonus de AduCoins
        else if (notif.tipo === 'BONUS_ADUCOINS') {
            html += `
                <div class="p-3 border-b hover:bg-gray-50 ${notif.leido ? 'opacity-60' : ''}"><p class="text-sm text-gray-800"><strong class="text-amber-600">¡Felicidades!</strong> El profesor <strong>${notif.remitente_nombre}</strong> te ha premiado con <strong class="font-mono">${notif.cantidad} AduCoins</strong> por tu publicación.</p></div>
            `;
        }
    });

    panel.innerHTML = html || '<p class="p-4 text-sm text-gray-500 text-center">No tienes notificaciones.</p>';
    badge.classList.toggle('hidden', unreadCount === 0);
}

function toggleNotifications() {
    playSound('soundClick');
    document.getElementById('notification-panel').classList.toggle('hidden');
}

function toggleProfileMenu() {
    playSound('soundClick');
    document.getElementById('profile-menu').classList.toggle('hidden');
}

// --- NUEVO: Lógica de Perfil y Avatares ---
function updateProfileView(userData) {
    // MODIFICADO: Usar iniciales en lugar de imagen
    document.getElementById('profile-avatar-initials').textContent = getInitials(userData.nombre);
    const xp = userData.puntaje || 0;
    const levelInfo = calculateLevel(xp);

    document.getElementById('profile-name').textContent = userData.nombre || 'Usuario';
    document.getElementById('profile-level-title').textContent = levelInfo.title;
    document.getElementById('profile-score').textContent = xp;
    document.getElementById('profile-missions').textContent = userData.misiones_completadas || 0;
    
    // Lógica para la barra de progreso de XP
    const currentLevelData = LEVELS.find(l => l.level === levelInfo.level);
    const xpForThisLevel = xp - (currentLevelData?.xpRequired || 0);
    const xpForNextLevel = levelInfo.nextLevelXP - (currentLevelData?.xpRequired || 0);
    const progressPercentage = xpForNextLevel > 0 ? (xpForThisLevel / xpForNextLevel) * 100 : 100;

    const xpBar = document.getElementById('profile-xp-bar');
    if (xpBar) {
        xpBar.style.width = `${progressPercentage}%`;
        document.getElementById('profile-next-level-num').textContent = levelInfo.level + 1;
        document.getElementById('profile-xp-progress-text').textContent = `${xpForThisLevel} / ${xpForNextLevel} XP`;
    }
}

async function acceptInvitation(notificationKey, roomId) {
    const notifRef = ref(db, `usuarios/${currentUserKey}/notificaciones/${notificationKey}`);
    const notifSnapshot = await get(notifRef);
    if (!notifSnapshot.exists()) {
        Swal.fire('Error', 'No se pudo encontrar la invitación.', 'error');
        return;
    }

    // Marcar la notificación como leída
    await update(notifRef, { leido: true });

    document.getElementById('notification-panel').classList.add('hidden');

    // 3. Redirigir al usuario directamente a la sala multijugador
    Swal.fire({
        title: 'Uniéndote a la Sala...',
        text: `Redirigiendo a la sala ${roomId}.`,
        icon: 'info',
        timer: 1500,
        showConfirmButton: false,
        timerProgressBar: true
    }).then(() => {
        // MODIFICADO: Redirige a sala_multijugador.html con el parámetro matchId
        window.location.href = `sala_multijugador.html?matchId=${roomId}`;
    });
}

async function markNotificationAsRead(notificationKey) {
    if (!currentUserKey || !notificationKey) return;
    const notifRef = ref(db, `usuarios/${currentUserKey}/notificaciones/${notificationKey}/leido`);
    await set(notifRef, true);
    // Opcional: cerrar el panel después de hacer clic
    document.getElementById('notification-panel').classList.add('hidden');
}

window.toggleNotifications = toggleNotifications;
window.toggleProfileMenu = toggleProfileMenu;
window.acceptInvitation = acceptInvitation;
// ----------------------------------------------------------------------
// 🎯 OTRAS FUNCIONES (Ranking, Audio, Juegos)
// ----------------------------------------------------------------------
function openGame(gameFile) {
    if (!playerNameGlobal || !currentUserKey) {
        Swal.fire('Acceso Denegado', 'Debes iniciar sesión para acceder a las actividades.', 'warning');
        return;
    }
    
    if (gameFile === 'sala_espera.html' || gameFile === 'role_dashboard.html') {
        window.location.href = gameFile; 
    } else {
        // CORRECCIÓN: Pasamos el playerKey a todos los juegos individuales
        window.location.href = `${gameFile}?playerKey=${currentUserKey}&playerName=${encodeURIComponent(playerNameGlobal)}`;
    }
}

// ----------------------------------------------------------------------
// 🚀 INICIALIZACIÓN Y EXPORTACIÓN DE FUNCIONES
// ----------------------------------------------------------------------

// LÓGICA CORREGIDA DEL SPLASH SCREEN (Mostrar solo una vez por sesión de navegador)
document.addEventListener('DOMContentLoaded', () => {
    // --- NUEVO: Lógica de inicialización con onAuthStateChanged ---
    // 1. Mostrar pantalla de carga
    const loadingScreen = document.getElementById('loading-screen');
    loadingScreen.classList.remove('hidden');
    document.getElementById('loading-text').textContent = 'Conectando...';

    // 2. Esperar a que la conexión con la base de datos esté activa
    const connectedRef = ref(db, '.info/connected');
    onValue(connectedRef, (snap) => {
        if (snap.val() === true) {
            console.log("Conectado a Firebase Realtime Database.");

            // Una vez conectados, habilitamos el botón de login
            const loginBtn = document.getElementById('login-btn');
            if (loginBtn) {
                loginBtn.disabled = false;
                loginBtn.textContent = 'Entrar';
                loginBtn.classList.remove('bg-gray-400', 'cursor-not-allowed');
                loginBtn.classList.add('bg-blue-600', 'hover:bg-blue-700');
            }

            // Y ahora sí, procedemos a verificar la sesión
            checkSession();

        } else {
            console.log("Desconectado de Firebase Realtime Database.");
            // Opcional: podrías mostrar un mensaje de error si la desconexión persiste.
        }
    }, (error) => {
        // Manejar errores de conexión a la base de datos
        console.error("Error al verificar conexión de DB:", error);
        Swal.fire('Error Crítico', 'No se pudo conectar a la base de datos. Por favor, recarga la página.', 'error');
        loadingScreen.classList.add('hidden');
        navigate('login');
    });

    // --- NUEVO: Centralización de Event Listeners ---
    const loginBtn = document.getElementById('login-btn');
    if (loginBtn) {
        loginBtn.addEventListener('click', login);
    }

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }

    document.querySelectorAll('[data-view]').forEach(button => {
        button.addEventListener('click', () => {
            const viewId = button.dataset.view;
            if (viewId === 'ranking') viewRanking();
            else navigate(viewId);
        });
    });

    document.querySelectorAll('[data-game]').forEach(button => {
        button.addEventListener('click', () => openGame(button.dataset.game));
    });
    
    // 🛠️ PWA / SERVICE WORKER REGISTRATION (Mantengo el bloque original)
     if ('serviceWorker' in navigator) {
         window.addEventListener('load', () => {
             navigator.serviceWorker.register('/sw.js', { scope: '/' }) 
                 .then(registration => {
                     console.log('Service Worker registrado con éxito. Scope:', registration.scope);
                 })
                 .catch(registrationError => {
                     console.log('Fallo el registro del Service Worker:', registrationError);
                 });
         });
     }
});

// Exportación de funciones globales para que funcionen con los atributos 'onclick' del HTML
window.login = login;
window.logout = logout;
window.viewRanking = viewRanking;
window.openGame = openGame;
// MODIFICADO: Añadimos las funciones que estaban en onclicks al scope global
// para asegurar compatibilidad con otras partes del código que puedan usarlas.
window.handleNotificationClick = handleNotificationClick;
window.playSound = playSound;
window.navigate = navigate;
window.showMainDashboard = showMainDashboard;