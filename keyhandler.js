// keyhandler.js (Cliente-side)

// URL base de tu API desplegada en Render.
// REEMPLAZA ESTA URL CON LA TUYA si cambia.
const ADUIA_API_BASE_URL = 'https://aduia.onrender.com';

/**
 * Función para llamar al endpoint de chat de la API de ADUIA.
 * Envía el payload completo de la API de OpenAI al backend de ADUIA.
 * * @param {object} payload - El objeto que el front-end quiere enviar (con messages, model, tools, etc.).
 * @returns {Promise<object>} La respuesta de la API de OpenAI.
 */
export async function callAduiaApi(payload) {
    // CORRECCIÓN CLAVE: Usar el endpoint /chat
    const chatEndpoint = `${ADUIA_API_BASE_URL}/chat`; 

    // Limpiamos los mensajes con 'content: null' antes de enviar.
    // Esto previene el error 400 de OpenAI cuando el mensaje del usuario está vacío 
    // o cuando el frontend intenta reutilizar un mensaje de herramienta malformado.
    const cleanedPayload = {
        ...payload,
        messages: payload.messages.filter(msg => msg.content !== null)
    };
    
    // Si necesitas enviar mensajes de tool_call (que tienen content: JSON) o 
    // tool_calls (que tienen content: null), el filtrado debe ser más sutil.
    // Mantendremos la versión limpia que asume que el backend maneja el payload completo
    // y solo necesitamos filtrar mensajes del usuario que estén vacíos.

    try {
        const response = await fetch(chatEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            // Enviamos el payload completo que incluye model, messages, tools, etc.
            body: JSON.stringify(payload), 
        });

        if (!response.ok) {
            // Manejo de errores detallado
            const errorText = await response.text();
            let errorData;
            try {
                errorData = JSON.parse(errorText);
            } catch (e) {
                // Si la respuesta no es JSON, usamos el texto puro.
                throw new Error(`Error ${response.status}: ${errorText || 'Fallo de conexión al servidor de la API.'}`);
            }
            throw new Error(`Error ${response.status}: ${errorData.error || 'Fallo de conexión al servidor de la API.'}`);
        }

        const data = await response.json();
        return data;

    } catch (error) {
        console.error("❌ Error en callAduiaApi:", error);
        throw error;
    }
}

// Exportar la URL base para otros scripts (como creador_juegos.html)
export const ADUIA_BASE_URL = ADUIA_API_BASE_URL;
