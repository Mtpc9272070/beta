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
    const chatEndpoint = `${ADUIA_API_BASE_URL}/`;

    // CORRECCIÓN: Filtrar mensajes con contenido nulo antes de enviar.
    // Cuando la IA responde con una llamada a herramienta (tool_calls), el 'content' es null.
    // El backend espera una cadena de texto, por lo que debemos limpiar el payload.
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
            // CORRECCIÓN: Enviar el payload completo, no solo el primer mensaje.
            // El backend de ADUIA ahora está preparado para recibir el objeto completo de OpenAI.
            body: JSON.stringify(cleanedPayload), 
        });

        if (!response.ok) {
            // Manejo de errores para capturar el mensaje de error del servidor.
            const errorData = await response.json();
            throw new Error(`Error ${response.status}: ${errorData.error || 'Fallo de conexión al servidor de la API.'}`);
        }

        const data = await response.json();
        return data;

    } catch (error) {
        console.error("❌ Error en callAduiaApi:", error);
        throw error;
    }
}
// Exportar la URL base para que sea utilizada por el checkApiStatus en creador_juegos.html
export const ADUIA_BASE_URL = ADUIA_API_BASE_URL;