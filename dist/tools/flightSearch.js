"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeBuscarVuelos = exports.buscarVuelosDeclaration = void 0;
const date_fns_1 = require("date-fns");
const genai_1 = require("@google/genai");
// 1. Declaración de la herramienta (Tool) usando tu esquema exacto
exports.buscarVuelosDeclaration = {
    name: 'buscarVuelos',
    description: 'Busca vuelos disponibles según el origen, destino, fecha de salida y opcionalmente filtros adicionales de retorno, pasajeros y tipo de cabina.',
    parameters: {
        type: genai_1.Type.OBJECT,
        properties: {
            origen: {
                type: genai_1.Type.STRING,
                description: 'OBLIGATORIO: Únicamente el código IATA de 3 letras en mayúsculas del origen (ej. "LIM").'
            },
            destino: {
                type: genai_1.Type.STRING,
                description: 'OBLIGATORIO: Únicamente el código IATA de 3 letras en mayúsculas del destino (ej. "CUZ").'
            },
            fechaSalida: {
                type: genai_1.Type.STRING,
                description: 'Fecha de salida en formato AAAA-MM-DD (ej. 2026-07-15). Puede venir en ISO 8601.'
            },
            pasajeros: {
                type: genai_1.Type.INTEGER,
                description: 'Cantidad de personas para las que se cotiza el vuelo.'
            }
        },
        required: ['origen', 'destino', 'fechaSalida']
    }
};
// 2. Funciones simuladas (Mocks) para cada GDS
// Cada una tiene un delay distinto para probar que Promise.all toma el tiempo de la más lenta, no la suma de todas.
const fetchAmadeus = async (origen, destino, fecha) => {
    await new Promise(res => setTimeout(res, 800)); // Simula 800ms
    return { gds: 'Amadeus', id: 'AM-1', precio: 250, aerolinea: 'AgilAir' };
};
const fetchSabre = async (origen, destino, fecha) => {
    await new Promise(res => setTimeout(res, 1200)); // Simula 1.2s (el más lento)
    return { gds: 'Sabre', id: 'SB-1', precio: 235, aerolinea: 'ExpertiaFly' };
};
const fetchTravelport = async (origen, destino, fecha) => {
    await new Promise(res => setTimeout(res, 600)); // Simula 600ms
    return { gds: 'Travelport', id: 'TP-1', precio: 260, aerolinea: 'B2BAirlines' };
};
// 3. Ejecutor principal invocado por Gemini
const executeBuscarVuelos = async (args) => {
    const { origen, destino, fechaSalida, pasajeros = 1 } = args;
    // FIX: Parseo seguro de la fecha para evitar el bug del ISO 8601 con 'Z'
    const parsedDate = (0, date_fns_1.parseISO)(fechaSalida);
    const fechaSegura = (0, date_fns_1.format)(parsedDate, 'yyyy-MM-dd');
    console.log(`\n🚀 [PoC] Lanzando búsquedas en paralelo para ${origen}-${destino} el ${fechaSegura} (${pasajeros} pax)...`);
    const startTime = Date.now();
    // EJECUCIÓN EN PARALELO: Dispara las 3 consultas al mismo tiempo
    const [resAmadeus, resSabre, resTravelport] = await Promise.all([
        fetchAmadeus(origen, destino, fechaSegura),
        fetchSabre(origen, destino, fechaSegura),
        fetchTravelport(origen, destino, fechaSegura)
    ]);
    const timeTaken = Date.now() - startTime;
    console.log(`✅ [PoC] Búsqueda completada en ${timeTaken}ms (Latencia dictada por GDS más lento)`);
    // Agrupamos, ordenamos por precio (opcional) y devolvemos al LLM
    const vuelosEncontrados = [resAmadeus, resSabre, resTravelport].sort((a, b) => a.precio - b.precio);
    return vuelosEncontrados;
};
exports.executeBuscarVuelos = executeBuscarVuelos;
