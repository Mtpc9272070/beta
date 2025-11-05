// yarvis-improved.js
// Sistema mejorado de asistente IA con mejor integración y respuestas naturales

import { getDatabase, ref, get, query, orderByChild, limitToLast } from "https://www.gstatic.com/firebasejs/9.6.11/firebase-database.js";
import { callAduiaApi } from "./keyhandler.js";

// ============================================
// SISTEMA DE HERRAMIENTAS MEJORADO
// ============================================

class YarvisTools {
    constructor(database, professorName) {
        this.db = database;
        this.professorName = professorName;
    }

    // Obtener datos reales de Firebase
    async getStats() {
        try {
            const [gamesSnap, casesSnap, studentsSnap] = await Promise.all([
                get(ref(this.db, 'custom_games')),
                get(ref(this.db, 'casos_estudio')),
                get(ref(this.db, 'usuarios'))
            ]);

            const games = gamesSnap.exists() ? Object.values(gamesSnap.val()) : [];
            const cases = casesSnap.exists() ? Object.values(casesSnap.val()) : [];
            const students = studentsSnap.exists() ? Object.values(studentsSnap.val()) : [];

            const myGames = games.filter(g => g.createdBy === this.professorName).length;
            const totalGames = games.length;
            const totalCases = cases.length;
            
            const activeStudents = students.filter(s => {
                const lastActive = s.lastActive || 0;
                const weekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
                return lastActive > weekAgo;
            }).length;

            const avgScore = students.length > 0
                ? Math.round(students.reduce((sum, s) => sum + (s.puntaje || 0), 0) / students.length)
                : 0;

            return {
                totalGames,
                myGames,
                totalCases,
                activeStudents,
                totalStudents: students.length,
                avgScore
            };
        } catch (error) {
            console.error('Error obteniendo stats:', error);
            return null;
        }
    }

    async getRanking(limit = 5) {
        try {
            const usersQuery = query(ref(this.db, 'usuarios'), orderByChild('puntaje'), limitToLast(limit));
            const snapshot = await get(usersQuery);
            
            if (!snapshot.exists()) return [];

            const ranking = [];
            snapshot.forEach(child => {
                ranking.push({
                    nombre: child.val().nombre || 'Usuario',
                    puntaje: child.val().puntaje || 0,
                    nivel: child.val().nivel || 1
                });
            });

            return ranking.reverse(); // Ordenar descendente
        } catch (error) {
            console.error('Error obteniendo ranking:', error);
            return [];
        }
    }

    async getMyGames() {
        try {
            const snapshot = await get(ref(this.db, 'custom_games'));
            if (!snapshot.exists()) return [];

            const allGames = Object.entries(snapshot.val());
            const myGames = allGames
                .filter(([_, game]) => game.createdBy === this.professorName)
                .map(([id, game]) => ({
                    id,
                    titulo: game.title || game.nombre || 'Sin título',
                    tipo: game.gameType || game.tipo || 'general',
                    fecha: game.createdAt || Date.now(),
                    jugadas: game.timesPlayed || 0
                }));

            return myGames;
        } catch (error) {
            console.error('Error obteniendo juegos:', error);
            return [];
        }
    }

    async getRecentActivity() {
        try {
            const studentsSnap = await get(ref(this.db, 'usuarios'));
            if (!studentsSnap.exists()) return [];

            const students = Object.values(studentsSnap.val());
            const inactive = students.filter(s => {
                const lastActive = s.lastActive || 0;
                const twoWeeksAgo = Date.now() - (14 * 24 * 60 * 60 * 1000);
                return lastActive < twoWeeksAgo;
            });

            return inactive.map(s => ({
                nombre: s.nombre || 'Usuario',
                ultimaActividad: s.lastActive ? new Date(s.lastActive).toLocaleDateString() : 'Nunca',
                puntaje: s.puntaje || 0
            }));
        } catch (error) {
            console.error('Error obteniendo actividad:', error);
            return [];
        }
    }

    async getPendingReviews() {
        try {
            const [gamesSnap, casesSnap] = await Promise.all([
                get(ref(this.db, 'custom_games')),
                get(ref(this.db, 'casos_estudio'))
            ]);

            const pending = [];

            if (gamesSnap.exists()) {
                const games = Object.entries(gamesSnap.val());
                games.forEach(([id, game]) => {
                    if (game.status === 'pending' || game.needsReview) {
                        pending.push({
                            tipo: 'juego',
                            titulo: game.title || 'Sin título',
                            creador: game.createdBy || 'Desconocido',
                            fecha: game.createdAt
                        });
                    }
                });
            }

            return pending;
        } catch (error) {
            console.error('Error obteniendo pendientes:', error);
            return [];
        }
    }
}

// ============================================
// ASISTENTE YARVIS CON IA MEJORADA
// ============================================

export class YarvisAssistant {
    constructor(professorName, database) {
        this.professorName = professorName;
        this.tools = new YarvisTools(database, professorName);
        this.conversationHistory = [];
        this.isProcessing = false;
        
        this.initializeSystemPrompt();
    }

    initializeSystemPrompt() {
        this.conversationHistory = [{
            role: 'system',
            content: `Eres Yarvis, un asistente ejecutivo de IA para profesores de comercio exterior en la plataforma ADUWEB.

PERSONALIDAD Y ESTILO:
- Profesional pero amigable y cercano
- Respuestas concisas y directas (2-3 oraciones máximo cuando sea posible)
- Proactivo: sugiere acciones cuando sea relevante
- IMPORTANTE: NUNCA uses asteriscos (*) para enfatizar. Usa mayúsculas solo cuando sea necesario
- IMPORTANTE: NUNCA uses formato markdown. Escribe en texto plano conversacional
- Usa emojis ocasionalmente para dar personalidad (🎯, 📊, 🎮, ✅, etc.)

CAPACIDADES:
Puedes ayudar con:
1. Ver estadísticas del panel
2. Consultar ranking de estudiantes
3. Revisar juegos creados
4. Ver estudiantes con baja actividad
5. Navegar a secciones específicas
6. Generar ideas de contenido

FORMATO DE RESPUESTA:
- Responde siempre en español
- Sé breve y al punto
- Si muestras datos, hazlo en formato legible pero NO uses markdown
- Ofrece acciones concretas cuando sea relevante

El profesor se llama: ${this.professorName}

Cuando el usuario pregunte por estadísticas, ranking, juegos, etc., responde que vas a consultar la información y luego llama a la función correspondiente.`
        }];
    }

    // Definir herramientas disponibles para la IA
    getToolDefinitions() {
        return [
            {
                type: 'function',
                function: {
                    name: 'obtener_estadisticas',
                    description: 'Obtiene estadísticas completas del panel: juegos creados, casos, estudiantes activos, etc.',
                    parameters: { type: 'object', properties: {} }
                }
            },
            {
                type: 'function',
                function: {
                    name: 'obtener_ranking',
                    description: 'Obtiene el ranking de los mejores estudiantes por puntaje',
                    parameters: {
                        type: 'object',
                        properties: {
                            limite: {
                                type: 'number',
                                description: 'Número de estudiantes a mostrar (por defecto 5)'
                            }
                        }
                    }
                }
            },
            {
                type: 'function',
                function: {
                    name: 'obtener_mis_juegos',
                    description: 'Lista todos los juegos creados por el profesor',
                    parameters: { type: 'object', properties: {} }
                }
            },
            {
                type: 'function',
                function: {
                    name: 'obtener_estudiantes_inactivos',
                    description: 'Lista estudiantes que no han tenido actividad reciente',
                    parameters: { type: 'object', properties: {} }
                }
            },
            {
                type: 'function',
                function: {
                    name: 'obtener_pendientes',
                    description: 'Lista elementos pendientes de revisión o aprobación',
                    parameters: { type: 'object', properties: {} }
                }
            },
            {
                type: 'function',
                function: {
                    name: 'navegar_a',
                    description: 'Navega a una sección específica del panel',
                    parameters: {
                        type: 'object',
                        properties: {
                            pagina: {
                                type: 'string',
                                enum: ['generador_casos.html', 'mis_juegos.html', 'editor_planes.html', 'editor_documentos.html', 'creador_juegos.html', 'adupost_moderation.html'],
                                description: 'La página a la que navegar'
                            }
                        },
                        required: ['pagina']
                    }
                }
            },
            {
                type: 'function',
                function: {
                    name: 'generar_ideas',
                    description: 'Genera ideas creativas para contenido educativo basado en un tema',
                    parameters: {
                        type: 'object',
                        properties: {
                            tema: {
                                type: 'string',
                                description: 'El tema sobre el que generar ideas (ej: Incoterms, Valoración Aduanera)'
                            }
                        }
                    }
                }
            }
        ];
    }

    // Ejecutar herramientas
    async executeTool(toolName, args = {}) {
        switch (toolName) {
            case 'obtener_estadisticas':
                return await this.tools.getStats();
            
            case 'obtener_ranking':
                return await this.tools.getRanking(args.limite || 5);
            
            case 'obtener_mis_juegos':
                return await this.tools.getMyGames();
            
            case 'obtener_estudiantes_inactivos':
                return await this.tools.getRecentActivity();
            
            case 'obtener_pendientes':
                return await this.tools.getPendingReviews();
            
            case 'navegar_a':
                return { action: 'navigate', page: args.pagina };
            
            case 'generar_ideas':
                return this.generateIdeas(args.tema);
            
            default:
                return { error: 'Herramienta no encontrada' };
        }
    }

    generateIdeas(tema = 'comercio exterior') {
        const ideas = {
            'incoterms': [
                'Quiz interactivo: Identifica el Incoterm correcto para cada situación',
                'Caso práctico: Negociación de términos entre exportador e importador',
                'Simulación: Calcula costos según diferentes Incoterms',
                'Juego de roles: Distribuir responsabilidades en una operación FOB vs CIF'
            ],
            'valoracion': [
                'Ejercicio: Cálculo de valor en aduana paso a paso',
                'Caso de estudio: Ajustes al valor de transacción',
                'Quiz: Métodos de valoración aduanera',
                'Simulación: Determinar el método de valoración correcto'
            ],
            'logistica': [
                'Planificación de ruta: Optimizar una cadena logística internacional',
                'Caso: Selección del modo de transporte adecuado',
                'Simulación: Gestión de documentación de exportación',
                'Quiz: Documentos necesarios según Incoterm'
            ],
            'default': [
                'Caso práctico: Exportación de productos locales',
                'Quiz de conocimientos generales de comercio exterior',
                'Simulación: Proceso completo de importación',
                'Juego: Negociación internacional de contratos'
            ]
        };

        const temaKey = tema.toLowerCase().includes('incoterm') ? 'incoterms'
            : tema.toLowerCase().includes('valor') ? 'valoracion'
            : tema.toLowerCase().includes('logist') ? 'logistica'
            : 'default';

        return ideas[temaKey];
    }

    // Procesar mensaje del usuario
    async processMessage(userMessage) {
        if (this.isProcessing) {
            return { error: 'Ya hay un mensaje procesándose' };
        }

        this.isProcessing = true;

        try {
            // Agregar mensaje del usuario al historial
            this.conversationHistory.push({
                role: 'user',
                content: userMessage
            });

            // Preparar payload para la API
            const payload = {
                model: 'gpt-4-turbo-preview',
                messages: this.conversationHistory,
                tools: this.getToolDefinitions(),
                tool_choice: 'auto',
                temperature: 0.7,
                max_tokens: 500
            };

            // Llamar a la API
            const response = await callAduiaApi(payload);
            const assistantMessage = response.choices[0].message;

            // Verificar si la IA quiere usar herramientas
            if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
                // Agregar respuesta de la IA al historial
                this.conversationHistory.push({
                    role: 'assistant',
                    content: assistantMessage.content,
                    tool_calls: assistantMessage.tool_calls
                });

                // Ejecutar todas las herramientas solicitadas
                const toolResults = [];
                for (const toolCall of assistantMessage.tool_calls) {
                    const functionName = toolCall.function.name;
                    const functionArgs = JSON.parse(toolCall.function.arguments);
                    
                    const result = await this.executeTool(functionName, functionArgs);
                    
                    toolResults.push({
                        tool_call_id: toolCall.id,
                        role: 'tool',
                        name: functionName,
                        content: JSON.stringify(result)
                    });
                }

                // Agregar resultados al historial
                this.conversationHistory.push(...toolResults);

                // Obtener respuesta final de la IA con los datos
                const finalPayload = {
                    model: 'gpt-4-turbo-preview',
                    messages: this.conversationHistory,
                    temperature: 0.7,
                    max_tokens: 500
                };

                const finalResponse = await callAduiaApi(finalPayload);
                const finalMessage = finalResponse.choices[0].message;

                this.conversationHistory.push({
                    role: 'assistant',
                    content: finalMessage.content
                });

                // Verificar si hay una acción de navegación
                const navigationResult = toolResults.find(r => {
                    const content = JSON.parse(r.content);
                    return content.action === 'navigate';
                });

                this.isProcessing = false;

                return {
                    message: finalMessage.content,
                    data: toolResults.map(r => JSON.parse(r.content)),
                    navigation: navigationResult ? JSON.parse(navigationResult.content) : null
                };
            } else {
                // Respuesta directa sin herramientas
                this.conversationHistory.push({
                    role: 'assistant',
                    content: assistantMessage.content
                });

                this.isProcessing = false;

                return {
                    message: assistantMessage.content,
                    data: null,
                    navigation: null
                };
            }
        } catch (error) {
            console.error('Error procesando mensaje:', error);
            this.isProcessing = false;
            
            return {
                message: 'Disculpa, tuve un problema al procesar tu solicitud. Por favor intenta de nuevo.',
                error: error.message
            };
        }
    }

    // Limpiar historial (mantener solo el system prompt)
    clearHistory() {
        this.initializeSystemPrompt();
    }

    // Obtener saludo inicial
    async getGreeting() {
        const stats = await this.tools.getStats();
        const pendientes = await this.tools.getPendingReviews();

        let greeting = `Hola ${this.professorName}! 👋 `;

        if (stats) {
            greeting += `Tienes ${stats.myGames} juegos creados y ${stats.activeStudents} estudiantes activos. `;
        }

        if (pendientes && pendientes.length > 0) {
            greeting += `Hay ${pendientes.length} elementos pendientes de revisión. `;
        } else {
            greeting += `Todo está al día! `;
        }

        greeting += `¿En qué puedo ayudarte hoy?`;

        return greeting;
    }
}