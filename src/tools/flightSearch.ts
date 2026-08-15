import { format, parseISO } from 'date-fns';
import { FunctionDeclaration, Type } from '@google/genai';
import { FlightSearchParams, MvFlightSearchRequest } from '../models/flightSearchModel';
import axios from 'axios';

// 1. Declaración de la herramienta (Tool) usando tu esquema exacto
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

// 2. Ejecutor principal invocado por Gemini
export const executeBuscarVuelos = async (params: FlightSearchParams, sessionId: string) => {
    try {
        const { origen, destino, fechaSalida, pasajeros = 1, fechaRetorno, clase } = params;

        // FIX: Parseo seguro de la fecha para evitar el bug del ISO 8601 con 'Z'
        const parsedDate = parseISO(fechaSalida);
        const fechaSegura = format(parsedDate, 'yyyy-MM-dd');

        console.log(`\n🚀 [PoC] Lanzando búsquedas en paralelo para ${origen}-${destino} el ${fechaSegura} (${pasajeros} pax)...`);
        const startTime = Date.now();

        // 1. PREPARACIÓN DE PARÁMETROS DINÁMICOS
        const trackingCode = crypto.randomUUID();
        const fromIP = '127.0.0.1';

        // 2. OBTENER TOKEN (Auth)
        const tokenUrl = 'https://qa2-motorvuelos.nmviajes-it.com/auth/api/auth/token';
        const tokenHeaders = {
            'ocp-apim-subscription-key': '669f9ad39d2943f6908522d00254fa32',
            'Content-Type': 'application/json'
        };

        const tokenPayload = {
            trackingCode,
            muteExceptions: false,
            caller: {
                company: 'Expertia',
                application: 'NMViajes',
                fromIP,
                fromBrowser: 'Server'
            },
            webId: 7,
            device: 3,
            userCode: 86798,
            appClient: 1
        };

        console.log('   [API] Obteniendo token de autenticación...');
        const tokenResponse = await axios.post(tokenUrl, tokenPayload, { headers: tokenHeaders });
        const { accessToken, proveedores } = tokenResponse.data;
        console.log(`   [API] Token OK. Proveedores disponibles: ${proveedores?.length || 0}`);

        if (!accessToken || !Array.isArray(proveedores)) {
            throw new Error('No se recibió un token de acceso o proveedores válidos.');
        }

        // 3. INICIAR BÚSQUEDA (Start Search)
        const authHeaders = {
            'Authorization': `Bearer ${accessToken}`,
            'ocp-apim-subscription-key': '669f9ad39d2943f6908522d00254fa32',
            'Content-Type': 'application/json'
        };

        const flightType = fechaRetorno ? 0 : 1; // 0: Roundtrip, 1: Oneway
        let flightClass = 0;
        if (clase === 'premium_economy') flightClass = 1;
        else if (clase === 'business' || clase === 'ejecutiva') flightClass = 2;

        const payloadBase: MvFlightSearchRequest = {
            flightType,
            flightClass,
            adults: Number(pasajeros) || 1,
            children: 0,
            infants: 0,
            email: '',
            departureLocation: String(origen).toUpperCase(),
            arrivalLocation: String(destino).toUpperCase(),
            departureDate: fechaSalida,
            searchTrackingCode: trackingCode,
        };

        if (fechaRetorno) {
            payloadBase.arrivalDate = fechaRetorno;
        }

        try {
            console.log('   [API] Iniciando start-search...');
            await axios.post('https://qa2-motorvuelos.nmviajes-it.com/mv/start-search', payloadBase, { headers: authHeaders });
        } catch (startError: any) {
            console.error('   ⚠️ [API] Error en start-search (ignorando):', startError.response?.data || startError.message);
        }

        // 4. BÚSQUEDAS EN SIMULTÁNEO (Paralelo por GDS)
        const axiosConfig = {
            headers: authHeaders,
            timeout: 30000 // 30s tolerancia QA
        };

        console.log(`   [API] Disparando búsquedas en paralelo a ${proveedores.length} GDS...`);
        const searchPromises = proveedores.map(prov => {
            const searchPayload = { ...payloadBase, gds: prov.proveedorId };
            return axios.post('https://qa2-motorvuelos.nmviajes-it.com/mv/search', searchPayload, axiosConfig)
                .then(res => ({ gds: prov.proveedorId, data: res.data, error: null })) // Mapeamos para saber de quién es el resultado
                .catch(err => ({ gds: prov.proveedorId, error: err.message, data: null }));
        });

        const searchResults = await Promise.allSettled(searchPromises);

        // 5. FINALIZAR BÚSQUEDA
        try {
            console.log('   [API] Enviando search-finish...');
            await axios.post('https://qa2-motorvuelos.nmviajes-it.com/mv/search-finish', {}, { headers: authHeaders });
        } catch (finishError: any) {
            console.error('   ⚠️ [API] Error en search-finish:', finishError.message);
        }

        // 6. PROCESAMIENTO DE RESULTADOS PARA GEMINI (Crucial para optimizar tokens)
        let vuelosEncontrados: any[] = [];

        searchResults.forEach((result) => {
            if (result.status === 'fulfilled' && !result.value.error) {
                const gdsData = result.value.data;
                if (gdsData && gdsData.groups) {
                    const topVuelos = gdsData.groups.map((group: any) => ({
                        gds: result.value.gds,
                        aerolinea: group.airline.name,
                        precio: group.pricingInfo.totalFare,
                        moneda: 'USD',
                        escala: group.departure?.flatMap((d: any) => d.segments)?.length > 1 ? 'Con Escalas' : 'Directo'
                    }));
                    vuelosEncontrados = [...vuelosEncontrados, ...topVuelos];
                }
            }
        });

        const executionTime = Date.now() - startTime;
        console.log(`✅ [GIA TOOL] Búsqueda finalizada en ${executionTime}ms. Vuelos extraídos: ${vuelosEncontrados.length}\n`);

        if (vuelosEncontrados.length === 0) {
            return JSON.stringify({
                status: "success",
                message: "La búsqueda finalizó correctamente, pero no se encontraron vuelos disponibles para estos criterios."
            });
        }

        vuelosEncontrados.sort((a, b) => a.precio - b.precio);
        const top3 = vuelosEncontrados.slice(0, 3);

        // Retornamos un JSON stringificado y limpio para Gemini
        return JSON.stringify({
            status: "success",
            total_opciones: top3.length,
            vuelos: top3,
            metadata: { latencia_ms: executionTime }
        });
    }
    catch (error: any) {
        console.error('❌ [GIA TOOL] Error crítico en la búsqueda:', error.message);
        return JSON.stringify({
            status: "error",
            message: "Ocurrió un error al consultar los sistemas GDS. Pide al usuario que intente más tarde.",
            detalle: error.message
        });
    }
};
