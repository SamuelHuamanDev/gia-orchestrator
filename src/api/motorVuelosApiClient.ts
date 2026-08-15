import axios from 'axios';
import { IFlightSearchGateway } from '../domain/flightSearch/ports';
import { AuthTokenResult, MvFlightSearchRequest, GdsSearchResult } from '../domain/flightSearch/entities';

const BASE_URL = 'https://qa2-motorvuelos.nmviajes-it.com';
const SUBSCRIPTION_KEY = '669f9ad39d2943f6908522d00254fa32';

export class MotorVuelosApiClient implements IFlightSearchGateway {
    async getAuthToken(trackingCode: string): Promise<AuthTokenResult> {
        const tokenUrl = `${BASE_URL}/auth/api/auth/token`;
        const tokenHeaders = {
            'ocp-apim-subscription-key': SUBSCRIPTION_KEY,
            'Content-Type': 'application/json'
        };

        const tokenPayload = {
            trackingCode,
            muteExceptions: false,
            caller: {
                company: 'Expertia',
                application: 'NMViajes',
                fromIP: '127.0.0.1',
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

        return { accessToken, proveedores };
    }

    async startSearch(payload: MvFlightSearchRequest, authHeaders: Record<string, string>): Promise<void> {
        try {
            console.log('   [API] Iniciando start-search...');
            await axios.post(`${BASE_URL}/mv/start-search`, payload, { headers: authHeaders });
        } catch (startError: any) {
            console.error('   ⚠️ [API] Error en start-search (ignorando):', startError.response?.data || startError.message);
        }
    }

    async searchGds(gdsId: string, payload: MvFlightSearchRequest, authHeaders: Record<string, string>): Promise<GdsSearchResult> {
        const axiosConfig = {
            headers: authHeaders,
            timeout: 30000 // 30s tolerancia QA
        };
        const searchPayload = { ...payload, gds: gdsId };

        try {
            const res = await axios.post(`${BASE_URL}/mv/search`, searchPayload, axiosConfig);
            return { gds: gdsId, data: res.data, error: null };
        } catch (err: any) {
            return { gds: gdsId, data: null, error: err.message };
        }
    }

    async finishSearch(authHeaders: Record<string, string>): Promise<void> {
        try {
            console.log('   [API] Enviando search-finish...');
            await axios.post(`${BASE_URL}/mv/search-finish`, {}, { headers: authHeaders });
        } catch (finishError: any) {
            console.error('   ⚠️ [API] Error en search-finish:', finishError.message);
        }
    }
}
