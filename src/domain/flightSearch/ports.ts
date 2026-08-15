import { AuthTokenResult, MvFlightSearchRequest, GdsSearchResult } from './entities';

export interface IFlightSearchGateway {
    getAuthToken(trackingCode: string): Promise<AuthTokenResult>;
    startSearch(payload: MvFlightSearchRequest, authHeaders: Record<string, string>): Promise<void>;
    searchGds(gdsId: string, payload: MvFlightSearchRequest, authHeaders: Record<string, string>): Promise<GdsSearchResult>;
    finishSearch(authHeaders: Record<string, string>): Promise<void>;
}
