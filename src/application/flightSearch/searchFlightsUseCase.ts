import { format, parseISO } from 'date-fns';
import { IFlightSearchGateway } from '../../domain/flightSearch/ports';
import { FlightSearchCriteria, FlightOffer, MvFlightSearchRequest } from '../../domain/flightSearch/entities';
import { MotorVuelosApiClient } from '../../api/motorVuelosApiClient';
import { config } from '../../core/config/env';

export interface SearchFlightsUseCaseResult {
    status: 'success' | 'error';
    totalOpciones?: number;
    vuelos?: FlightOffer[];
    message?: string;
    detalle?: string;
    executionTimeMs?: number;
}

export class SearchFlightsUseCase {
    constructor(private readonly gateway: IFlightSearchGateway = new MotorVuelosApiClient()) { }

    async execute(params: FlightSearchCriteria, sessionId: string): Promise<SearchFlightsUseCaseResult> {
        const { origen, destino, fechaSalida, pasajeros = 1, fechaRetorno, clase } = params;
        const startTime = Date.now();

        try {
            // Parseo seguro de la fecha
            const parsedDate = parseISO(fechaSalida);
            const fechaSegura = format(parsedDate, 'yyyy-MM-dd');

            console.log(`\n🚀 [PoC] Lanzando búsquedas en paralelo para ${origen}-${destino} el ${fechaSegura} (${pasajeros} pax)...`);

            const trackingCode = crypto.randomUUID();

            // 1. OBTENER TOKEN
            const { accessToken, proveedores } = await this.gateway.getAuthToken(trackingCode);

            const authHeaders = {
                'Authorization': `Bearer ${accessToken}`,
                'ocp-apim-subscription-key': config.mvSubscriptionKey,
                'Content-Type': 'application/json'
            };

            // 2. CONSTRUIR PAYLOAD BASE
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

            // 3. INICIAR BÚSQUEDA
            await this.gateway.startSearch(payloadBase, authHeaders);

            // 4. BÚSQUEDAS EN PARALELO POR GDS
            console.log(`   [API] Disparando búsquedas en paralelo a ${proveedores.length} GDS...`);
            const searchPromises = proveedores.map(prov =>
                this.gateway.searchGds(prov.proveedorId, payloadBase, authHeaders)
            );

            const searchResults = await Promise.allSettled(searchPromises);

            // 5. FINALIZAR BÚSQUEDA
            await this.gateway.finishSearch(authHeaders);

            // 6. PROCESAMIENTO Y MAPEADO DE RESULTADOS
            let vuelosEncontrados: FlightOffer[] = [];

            searchResults.forEach((result) => {
                if (result.status === 'fulfilled' && !result.value.error) {
                    const gdsData = result.value.data;
                    if (gdsData && gdsData.groups) {
                        const topVuelos: FlightOffer[] = gdsData.groups.map((group: any) => ({
                            gds: result.value.gds,
                            aerolinea: group.airline?.name || 'Desconocida',
                            precio: group.pricingInfo?.totalFare || 0,
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
                return {
                    status: 'success',
                    totalOpciones: 0,
                    vuelos: [],
                    message: 'La búsqueda finalizó correctamente, pero no se encontraron vuelos disponibles para estos criterios.',
                    executionTimeMs: executionTime
                };
            }

            vuelosEncontrados.sort((a, b) => a.precio - b.precio);
            const top3 = vuelosEncontrados.slice(0, 3);

            return {
                status: 'success',
                totalOpciones: top3.length,
                vuelos: top3,
                executionTimeMs: executionTime
            };
        } catch (error: any) {
            console.error('❌ [GIA TOOL] Error crítico en la búsqueda:', error.message);
            return {
                status: 'error',
                message: 'Ocurrió un error al consultar los sistemas GDS. Pide al usuario que intente más tarde.',
                detalle: error.message
            };
        }
    }
}
