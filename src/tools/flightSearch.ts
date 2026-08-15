import { FunctionDeclaration, Type } from '@google/genai';
import { SearchFlightsUseCase } from '../application/flightSearch/searchFlightsUseCase';
import { FlightSearchCriteria } from '../domain/flightSearch/entities';

const searchFlightsUseCase = new SearchFlightsUseCase();

// 1. Declaración de la herramienta (Tool) usando el esquema exacto de Gemini
export const buscarVuelosDeclaration: FunctionDeclaration = {
    name: 'buscarVuelos',
    description: 'Busca vuelos disponibles según el origen, destino, fecha de salida y opcionalmente filtros adicionales de retorno, pasajeros y tipo de cabina.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            origen: {
                type: Type.STRING,
                description: 'OBLIGATORIO: Únicamente el código IATA de 3 letras en mayúsculas del origen (ej. "LIM").'
            },
            destino: {
                type: Type.STRING,
                description: 'OBLIGATORIO: Únicamente el código IATA de 3 letras en mayúsculas del destino (ej. "CUZ").'
            },
            fechaSalida: {
                type: Type.STRING,
                description: 'Fecha de salida en formato AAAA-MM-DD (ej. 2026-07-15). Puede venir en ISO 8601.'
            },
            pasajeros: {
                type: Type.INTEGER,
                description: 'Cantidad de personas para las que se cotiza el vuelo.'
            },
            fechaRetorno: {
                type: Type.STRING,
                description: 'Fecha de retorno en formato AAAA-MM-DD (ej. 2026-07-15). Opcional.'
            },
            clase: {
                type: Type.STRING,
                description: 'Clase del vuelo. Opciones: "economy", "premium_economy", "business" (ej. "economy"). Opcional.'
            }
        },
        required: ['origen', 'destino', 'fechaSalida']
    }
};

// 2. Ejecutor principal invocado por Gemini (Tool Adapter)
export const executeBuscarVuelos = async (params: FlightSearchCriteria, sessionId: string): Promise<string> => {
    const result = await searchFlightsUseCase.execute(params, sessionId);

    if (result.status === 'error') {
        return JSON.stringify({
            status: 'error',
            message: result.message,
            detalle: result.detalle
        });
    }

    if (result.vuelos && result.vuelos.length === 0) {
        return JSON.stringify({
            status: 'success',
            message: result.message
        });
    }

    return JSON.stringify({
        status: 'success',
        total_opciones: result.totalOpciones,
        vuelos: result.vuelos,
        metadata: { latencia_ms: result.executionTimeMs }
    });
};
