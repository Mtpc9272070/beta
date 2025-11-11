/**
 * @file modulo_arancel.js
 * @description Gestiona el panel central de la herramienta de arancel en la Estación de Clasificación.
 * Verifica el acceso del usuario a la herramienta y gestiona el proceso de compra.
 */

import { checkToolAccess, purchaseTool, getUserXP } from './xp_controller.js';
import Swal from 'https://cdn.jsdelivr.net/npm/sweetalert2@11/src/sweetalert2.js';

// --- CONSTANTES DE LA HERRAMIENTA ---
const TOOL_ID = 'herramienta_arancel';
const TOOL_COST = 1500; // Costo en XP
const TOOL_NAME = 'Visor de Arancel Profesional';

let currentUserId = null;
let targetElement = null;

/**
 * Renderiza la interfaz de la herramienta de arancel completa.
 */
function renderToolInterface() {
    targetElement.innerHTML = `
        <div class="h-full flex flex-col items-center justify-center bg-green-50 rounded-lg border-2 border-dashed border-green-300 p-4">
            <h3 class="text-2xl font-bold text-green-800">✅ ${TOOL_NAME} Desbloqueado</h3>
            <p class="text-gray-600 mt-2">Aquí se cargaría la interfaz interactiva de búsqueda de aranceles.</p>
            <input type="text" placeholder="Buscar por código o descripción..." class="mt-4 w-full max-w-md p-2 border rounded-lg">
        </div>
    `;
}

/**
 * Renderiza la pantalla de "herramienta bloqueada" con la opción de compra.
 */
async function renderPurchasePrompt() {
    const userXP = await getUserXP(currentUserId);

    targetElement.innerHTML = `
        <div class="h-full flex flex-col items-center justify-center bg-gray-100 rounded-lg border-2 border-dashed p-6 text-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <h3 class="text-2xl font-bold text-gray-800">Herramienta Bloqueada</h3>
            <p class="text-gray-600 mt-2">Necesitas el <strong>${TOOL_NAME}</strong> para continuar.</p>
            <div class="my-4">
                <p class="text-lg">Costo: <span class="font-bold text-purple-600">${TOOL_COST} XP</span></p>
                <p class="text-sm">Tu Saldo: <span class="font-semibold text-gray-700">${userXP} XP</span></p>
            </div>
            <button id="buy-tool-btn" class="bg-blue-600 text-white font-bold px-6 py-3 rounded-lg shadow-md hover:bg-blue-700 transition-transform transform hover:scale-105">
                Desbloquear por ${TOOL_COST} XP
            </button>
        </div>
    `;

    document.getElementById('buy-tool-btn').addEventListener('click', handlePurchase);
}

/**
 * Maneja el evento de clic en el botón de comprar.
 */
async function handlePurchase() {
    Swal.fire({
        title: `¿Confirmas la compra?`,
        html: `Se descontarán <strong>${TOOL_COST} XP</strong> de tu cuenta para desbloquear el <strong>${TOOL_NAME}</strong>.`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sí, comprar',
        cancelButtonText: 'Cancelar',
        showLoaderOnConfirm: true,
        preConfirm: async () => {
            const result = await purchaseTool(currentUserId, TOOL_ID, TOOL_COST);
            if (!result.success) {
                const reason = result.reason === 'insufficient_funds'
                    ? 'No tienes suficientes Puntos de Experiencia (XP).'
                    : 'La compra falló. Inténtalo de nuevo.';
                Swal.showValidationMessage(reason);
            }
            return result;
        },
        allowOutsideClick: () => !Swal.isLoading()
    }).then((result) => {
        if (result.isConfirmed && result.value.success) {
            Swal.fire(
                '¡Compra Exitosa!',
                `Has desbloqueado la herramienta. Tu nuevo saldo es ${result.value.newScore} XP.`,
                'success'
            );
            // Una vez comprado, renderizamos la herramienta real.
            renderToolInterface();
        }
    });
}

/**
 * Función principal de inicialización del módulo.
 * @param {string} userId - El ID del usuario actual.
 * @param {string} elementId - El ID del elemento HTML donde se renderizará el módulo.
 */
export async function initArancelModule(userId, elementId) {
    currentUserId = userId;
    targetElement = document.getElementById(elementId);

    if (!targetElement) {
        console.error(`El elemento con ID "${elementId}" no fue encontrado.`);
        return;
    }

    const hasAccess = await checkToolAccess(currentUserId, TOOL_ID);

    if (hasAccess) {
        renderToolInterface();
    } else {
        renderPurchasePrompt();
    }
}