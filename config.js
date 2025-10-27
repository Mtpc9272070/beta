// ⚙️ Configuración Firebase (Centralizada)
// Para producción, las claves se inyectan desde variables de entorno (import.meta.env).
// Para desarrollo local (sin Vite), usamos las claves hardcodeadas como fallback.
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.11/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/9.6.11/firebase-database.js";

export const firebaseConfig = {
    apiKey: import.meta.env?.VITE_FIREBASE_API_KEY || "AIzaSyB_eUoNQ7L4hd42SVPqbA7vNYHxpEii9To",
    authDomain: import.meta.env?.VITE_FIREBASE_AUTH_DOMAIN || "dino-4fbde.firebaseapp.com",
    databaseURL: import.meta.env?.VITE_FIREBASE_DATABASE_URL || "https://dino-4fbde-default-rtdb.firebaseio.com",
    projectId: import.meta.env?.VITE_FIREBASE_PROJECT_ID || "dino-4fbde",
    storageBucket: import.meta.env?.VITE_FIREBASE_STORAGE_BUCKET || "dino-4fbde.firebasestorage.app",
    messagingSenderId: import.meta.env?.VITE_FIREBASE_MESSAGING_SENDER_ID || "307345167689",
    appId: import.meta.env?.VITE_FIREBASE_APP_ID || "1:307345167689:web:f75e11b0c68a3def253698",
    measurementId: import.meta.env?.VITE_FIREBASE_MEASUREMENT_ID || "G-LFDL5N5VW3"
};

// 🤖 Clave de API de OpenAI (Ofuscada en Base64 para seguridad básica)
// ¡IMPORTANTE! La mejor práctica es usar una Cloud Function como intermediario.
export const openAiApiKey = "API_KEY";

// 💼 DATOS DE CARRERAS (Los 11 roles solicitados)
export const CAREER_ROLES = [
    { id: 'comex_analyst', name: 'Analista de Comercio Exterior', desc: 'Enfocado en procesos, documentación y operativa aduanera.' },
    { id: 'customs_agent', name: 'Agente Aduanal/Despachante', desc: 'Especialista en legislación, trámites y representación legal.' },
    { id: 'import_manager', name: 'Gerente de Importaciones', desc: 'Se centra en costos, valoración y gestión de proveedores internacionales.' },
    { id: 'export_specialist', name: 'Especialista en Exportaciones', desc: 'Maneja Incoterms, logística de salida y regulaciones de destino.' },
    { id: 'logistics_coordinator', name: 'Coordinador de Logística', desc: 'Optimiza rutas, transporte, almacenamiento y transferencia de riesgo.' },
    { id: 'valuation_expert', name: 'Experto en Valoración', desc: 'Profundiza en el cálculo del Landed Cost y la base gravable de tributos.' },
    { id: 'tariffs_specialist', name: 'Especialista en Aranceles', desc: 'Dominio de la Nomenclatura, clasificación y reglas generales interpretativas.' },
    { id: 'compliance_officer', name: 'Oficial de Cumplimiento Aduanero', desc: 'Verifica el cumplimiento de regulaciones no arancelarias y restricciones.' },
    { id: 'supply_chain_planner', name: 'Planificador de Cadena de Suministro', desc: 'Integra procesos desde el origen hasta el destino final (end-to-end).' },
    { id: 'trade_consultant', name: 'Consultor de Negocios Internacionales', desc: 'Visión estratégica de negociación, Incoterms y acuerdos comerciales.' },
    { id: 'incoterms_auditor', name: 'Auditor de Incoterms', desc: 'Revisa contratos y documentos para validar el uso correcto de los Términos.' },
];

// 📚 DATOS DE ENTRENAMIENTO (Agrupados por área)
export const TRAINING_AREAS = [
    { 
        id: 'area_docs', name: 'Gestión Documental y Cumplimiento', 
        roles: [
            { id: 'comex_analyst', name: 'Analista de Comercio Exterior', desc: 'Procesos, documentación y operativa.' },
            { id: 'customs_agent', name: 'Agente Aduanal', desc: 'Legislación, trámites y representación.' },
            { id: 'compliance_officer', name: 'Oficial de Cumplimiento', desc: 'Regulaciones no arancelarias.' },
            { id: 'tariffs_specialist', name: 'Especialista en Aranceles', desc: 'Nomenclatura y clasificación.' },
        ] 
    },
    {
        id: 'area_costs', name: 'Costos y Finanzas Internacionales',
        roles: [
            { id: 'import_manager', name: 'Gerente de Importaciones', desc: 'Costos, valoración y proveedores.' },
            { id: 'valuation_expert', name: 'Experto en Valoración', desc: 'Cálculo del Landed Cost.' },
        ]
    },
    {
        id: 'area_logistics', name: 'Logística y Cadena de Suministro',
        roles: [
            { id: 'logistics_coordinator', name: 'Coordinador de Logística', desc: 'Rutas, transporte y riesgo.' },
            { id: 'supply_chain_planner', name: 'Planificador de Cadena de Suministro', desc: 'Procesos end-to-end.' },
        ]
    },
    {
        id: 'area_strategy', name: 'Estrategia Comercial y Términos',
        roles: [
            { id: 'export_specialist', name: 'Especialista en Exportaciones', desc: 'Incoterms y logística de salida.' },
            { id: 'trade_consultant', name: 'Consultor de Negocios', desc: 'Negociación y acuerdos.' },
            { id: 'incoterms_auditor', name: 'Auditor de Incoterms', desc: 'Validación de uso de Términos.' },
        ]
    }
];

// --- NUEVO: Sistema de Niveles y Progresión ---
export const LEVELS = [
    { level: 1, xpRequired: 0, title: 'Aprendiz Aduanero' },
    { level: 2, xpRequired: 1000, title: 'Estudiante Avanzado' },
    { level: 3, xpRequired: 2500, title: 'Practicante Destacado' },
    { level: 4, xpRequired: 5000, title: 'Asistente Profesional' },
    { level: 5, xpRequired: 10000, title: 'Adu-Experto' }
];

export function calculateLevel(xp) {
    let currentLevelData = LEVELS[0];
    for (let i = LEVELS.length - 1; i >= 0; i--) {
        if (xp >= LEVELS[i].xpRequired) {
            currentLevelData = LEVELS[i];
            break;
        }
    }
    const nextLevel = LEVELS.find(l => l.level === currentLevelData.level + 1);
    return { ...currentLevelData, nextLevelXP: nextLevel ? nextLevel.xpRequired : currentLevelData.xpRequired };
}



