/**
 * utils.js
 * Funciones de utilidad compartidas en todo el proyecto ADUWEB.
 */
import { getDatabase, ref, update, increment, runTransaction } from "https://www.gstatic.com/firebasejs/9.6.11/firebase-database.js";

/**
 * Plays an audio element by its ID.
 * Rewinds to start for immediate playback.
 * Catches and logs any errors during playback.
 * @param {string} id The ID of the audio element to play.
 */
export function playSound(id) {
    const audio = document.getElementById(id);
    if (audio) {
        audio.currentTime = 0; // Rewind to start for immediate playback
        audio.play().catch(e => console.warn(`Error playing sound '${id}':`, e));
    } else {
        console.warn(`Audio element with ID '${id}' not found.`);
    }
}

/**
 * Stops an audio element by its ID and rewinds it to the beginning.
 * @param {string} id The ID of the audio element to stop.
 */
export function stopSound(id) {
    const audio = document.getElementById(id);
    if (audio) {
        audio.pause();
        audio.currentTime = 0; // Rewind to start
    } else {
        console.warn(`Audio element with ID '${id}' not found for stopping.`);
    }
}

/**
 * Guarda el resultado de un juego (puntaje y calificación) en Firebase.
 * Actualiza el puntaje global del usuario y las estadísticas del juego.
 * @param {string} gameId - El identificador único del juego (ej: 'carrera_reloj').
 * @param {number} score - El puntaje obtenido por el usuario en el juego.
 * @param {number|null} rating - La calificación (1-5) dada por el usuario, o null si no aplica.
 */
export async function saveGameResult(db, gameId, score, rating) {
    const playerKey = localStorage.getItem('aduweb_player_key');
    if (!playerKey) {
        console.log("No hay usuario logueado, no se guardará el puntaje.");
        return;
    }

    const updates = {};
    const timestamp = Date.now();

    // 1. Actualizar el puntaje global del usuario y su historial
    updates[`usuarios/${playerKey}/puntaje`] = increment(score);
    updates[`usuarios/${playerKey}/game_history/${gameId}/last_score`] = score;
    updates[`usuarios/${playerKey}/game_history/${gameId}/last_played`] = timestamp;
    updates[`usuarios/${playerKey}/game_history/${gameId}/times_played`] = increment(1);

    // Aplicar las actualizaciones del usuario
    await update(ref(db), updates);

    // 2. Si hay una calificación, actualizar las estadísticas del juego usando una transacción
    if (rating !== null && rating >= 1 && rating <= 5) {
        const gameMetaRef = ref(db, `games_metadata/${gameId}`);
        await runTransaction(gameMetaRef, (currentData) => {
            if (currentData) {
                currentData.rating_count = (currentData.rating_count || 0) + 1;
                currentData.total_ratings = (currentData.total_ratings || 0) + rating;
                currentData.average_rating = currentData.total_ratings / currentData.rating_count;
            } else {
                // Si es la primera calificación para este juego
                return { rating_count: 1, total_ratings: rating, average_rating: rating };
            }
            return currentData;
        });
    }
    console.log(`Resultado guardado para ${gameId}: score=${score}, rating=${rating}`);
}