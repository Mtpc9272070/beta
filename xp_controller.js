/**
 * @file xp_controller.js
 * @description Módulo para gestionar la lógica de Puntos de Experiencia (XP) y la compra de herramientas.
 * Interactúa con Firebase para verificar el acceso y procesar las compras.
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.11/firebase-app.js";
import { getDatabase, ref, get, runTransaction } from "https://www.gstatic.com/firebasejs/9.6.11/firebase-database.js";
import { firebaseConfig } from "../config.js";

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

/**
 * Verifica si un usuario ha comprado una herramienta específica.
 * @param {string} userId - El ID del usuario en Firebase.
 * @param {string} toolId - El ID de la herramienta (ej: "herramienta_arancel").
 * @returns {Promise<boolean>} - Devuelve `true` si el usuario posee la herramienta, de lo contrario `false`.
 */
export async function checkToolAccess(userId, toolId) {
    if (!userId || !toolId) {
        console.error("Se requiere userId y toolId para verificar el acceso.");
        return false;
    }

    try {
        const toolRef = ref(db, `usuarios/${userId}/herramientas_compradas/${toolId}`);
        const snapshot = await get(toolRef);
        return snapshot.exists() && snapshot.val() === true;
    } catch (error) {
        console.error("Error al verificar el acceso a la herramienta:", error);
        return false;
    }
}

/**
 * Obtiene el puntaje (XP) actual de un usuario.
 * @param {string} userId - El ID del usuario en Firebase.
 * @returns {Promise<number>} - El puntaje actual del usuario, o 0 si hay un error.
 */
export async function getUserXP(userId) {
    if (!userId) {
        console.error("Se requiere userId para obtener el XP.");
        return 0;
    }

    try {
        const userRef = ref(db, `usuarios/${userId}/puntaje`);
        const snapshot = await get(userRef);
        return snapshot.exists() ? snapshot.val() : 0;
    } catch (error) {
        console.error("Error al obtener el XP del usuario:", error);
        return 0;
    }
}

/**
 * Procesa la compra de una herramienta para un usuario.
 * Utiliza una transacción para garantizar la consistencia de los datos.
 * @param {string} userId - El ID del usuario que realiza la compra.
 * @param {string} toolId - El ID de la herramienta a comprar.
 * @param {number} toolCost - El costo en XP de la herramienta.
 * @returns {Promise<{success: boolean, reason?: string, newScore?: number}>} - Un objeto indicando el resultado.
 * - `success: true` si la compra fue exitosa.
 * - `success: false` con un `reason` si falló (ej: 'insufficient_funds').
 */
export async function purchaseTool(userId, toolId, toolCost) {
    if (!userId || !toolId || typeof toolCost !== 'number') {
        return { success: false, reason: 'invalid_arguments' };
    }

    const userRef = ref(db, `usuarios/${userId}`);

    try {
        const { committed, snapshot } = await runTransaction(userRef, (userData) => {
            if (userData === null) {
                // El usuario no existe, abortar transacción.
                return;
            }

            // Asegurarse de que el puntaje y las herramientas existen
            if (typeof userData.puntaje === 'undefined') {
                userData.puntaje = 0;
            }
            if (typeof userData.herramientas_compradas === 'undefined') {
                userData.herramientas_compradas = {};
            }

            // Verificar si ya posee la herramienta
            if (userData.herramientas_compradas[toolId] === true) {
                // Abortar la transacción devolviendo `undefined`
                return; 
            }

            // Verificar si tiene suficientes puntos
            if (userData.puntaje >= toolCost) {
                userData.puntaje -= toolCost; // Restar el costo
                userData.herramientas_compradas[toolId] = true; // Marcar como comprada
            }
            // Si no tiene suficientes puntos, la transacción se abortará automáticamente
            // al no modificar `userData`.

            return userData; // Devolver los datos modificados para que Firebase los escriba
        });

        if (committed) {
            const finalData = snapshot.val();
            if (finalData.herramientas_compradas && finalData.herramientas_compradas[toolId]) {
                return { success: true, newScore: finalData.puntaje };
            } else {
                return { success: false, reason: 'insufficient_funds' };
            }
        } else {
            return { success: false, reason: 'transaction_aborted' }; // Podría ser por fondos insuficientes o porque ya la tenía
        }
    } catch (error) {
        console.error("Error en la transacción de compra:", error);
        return { success: false, reason: 'transaction_error' };
    }
}