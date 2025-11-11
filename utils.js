// --- Funciones de Utilidad (utils.js) ---

import { ref, update, increment } from "https://www.gstatic.com/firebasejs/9.6.11/firebase-database.js";

/**
 * Reproduce un efecto de sonido.
 * @param {string} id El ID del elemento <audio> a reproducir.
 */
export function playSound(id) {
    const audio = document.getElementById(id);
    if (audio) {
        audio.currentTime = 0;
        audio.play().catch(e => console.warn(`No se pudo reproducir el sonido ${id}:`, e));
    }
}

export function stopSound(id) {
    const audio = document.getElementById(id);
    if (audio) { audio.pause(); audio.currentTime = 0; }
}

/**
 * Guarda el resultado de un juego de plantilla estándar.
 * @param {object} db - La instancia de la base de datos de Firebase.
 * @param {string} gameId - El ID de la plantilla del juego (ej: 'time_trial').
 * @param {number} score - El puntaje obtenido por el jugador.
 * @param {number} rating - La calificación dada por el jugador (1-5).
 */
export async function saveGameResult(db, gameId, score, rating) {
    const gameStatsRef = ref(db, `games_metadata/${gameId}`);
    const updates = {};
    updates[`times_played`] = increment(1);
    updates[`total_score`] = increment(score);
    updates[`total_ratings`] = increment(rating);
    updates[`rating_count`] = increment(1);

    // Para calcular el promedio más adelante, puedes hacer (total_score / times_played) y (total_ratings / rating_count)
    await update(gameStatsRef, updates);
}

/**
 * Guarda el resultado de un juego personalizado creado por un profesor.
 * @param {object} db - La instancia de la base de datos de Firebase.
 * @param {string} customGameId - El ID único del juego personalizado.
 * @param {number} score - El puntaje obtenido por el jugador.
 * @param {number|null} rating - La calificación dada por el jugador (1-5), o null si no aplica.
 */
export async function saveCustomGameResult(db, customGameId, score, rating) {
    const gameStatsRef = ref(db, `games_metadata/${customGameId}`);
    const updates = {};
    updates[`times_played`] = increment(1);
    updates[`total_score`] = increment(score);
    if (rating !== null) {
        updates[`total_ratings`] = increment(rating);
        updates[`rating_count`] = increment(1);
    }
    await update(gameStatsRef, updates);
}