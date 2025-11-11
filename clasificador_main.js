/**
 * @file clasificador_main.js
 * @description Script principal para la Estación de Clasificación.
 * Orquesta la inicialización de todos los módulos de la interfaz.
 */

import { initArancelModule } from './modulo_arancel.js';
// import { initMercanciaModule } from './modulo_mercancia.js'; // Futuro módulo
// import { initDocumentosModule } from './modulo_documentos.js'; // Futuro módulo

document.addEventListener('DOMContentLoaded', () => {
    // En una aplicación real, obtendrías el ID del usuario de la sesión.
    // Para este ejemplo, usaremos un ID de prueba.
    const MOCK_USER_ID = 'USER_ID_1'; // Reemplaza con un ID de tu Firebase
    const MOCK_CASE_ID = 'CASO_001';

    console.log("Inicializando Estación de Clasificación...");

    // Inicializar el módulo central de la herramienta de arancel
    initArancelModule(MOCK_USER_ID, 'herramienta-content');

    // Aquí inicializarías los otros módulos
    // initMercanciaModule(MOCK_CASE_ID, 'mercancia-content');
    // initDocumentosModule(MOCK_CASE_ID, 'documentos-content');
});