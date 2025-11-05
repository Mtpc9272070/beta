// keyhandler.js (Cliente-side)

// URL base de tu API desplegada en Render.
// REEMPLAZA ESTA URL CON LA TUYA.
const ADUIA_API_BASE_URL = 'https://aduia.onrender.com';

/**
 * Función para llamar al endpoint de chat de la API de ADUIA.
 * Envía el payload completo de la API de OpenAI al backend de ADUIA.
 * @param {object} payload - El objeto que el front-end quiere enviar (con messages, model, etc.).
 * @returns {Promise<object>} La respuesta de la API de OpenAI.
 */
export async function callAduiaApi(payload) {
    // CORRECCIÓN CLAVE: Apunta al endpoint '/chat' de tu backend.
    const chatEndpoint = `${ADUIA_API_BASE_URL}/chat`; 

    // Filtrar mensajes con contenido nulo (necesario para la comunicación tool_call/tool_response).
    const cleanedPayload = {
        ...payload,
        messages: payload.messages.filter(msg => msg.content !== null)
    };

    try {
        const response = await fetch(chatEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(cleanedPayload), 
        });

        // 1. Verificar si la respuesta fue exitosa (código 200)
        if (!response.ok) {
            let errorText = await response.text();
            
            // Manejo de error para el 404/500 que devuelve HTML en lugar de JSON.
            if (errorText.startsWith('<!DOCTYPE')) {
                errorText = `El servidor de la API (${response.status}) devolvió una página de error (HTML), no JSON.`;
            }
            throw new Error(`Error ${response.status}: ${errorText || 'Fallo de conexión al servidor de la API.'}`);
        }

        // 2. Intentar parsear a JSON.
        const data = await response.json();
        return data;

    } catch (error) {
        console.error("❌ Error en callAduiaApi:", error);
        throw error;
    }
}

// Exportar la URL base para que sea utilizada por otras funciones si es necesario
// Esta posición final resuelve el 'SyntaxError: Unexpected token export'.
export const ADUIA_BASE_URL = ADUIA_API_BASE_URL;

// NOTA: Si tenías otras funciones como callImageApi() en este archivo,
// puedes añadirlas aquí, asegurándote de usar 'export' delante de ellas.
