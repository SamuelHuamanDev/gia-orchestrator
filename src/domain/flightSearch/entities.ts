export interface FlightSearchCriteria {
    origen: string;
    destino: string;
    fechaSalida: string;
    fechaRetorno?: string;
    pasajeros?: number;
    clase?: string;
}

export interface FlightOffer {
    gds: string;
    aerolinea: string;
    precio: number;
    moneda: string;
    escala: string;
}

export interface GdsProvider {
    proveedorId: string;
    [key: string]: unknown;
}

export interface AuthTokenResult {
    accessToken: string;
    proveedores: GdsProvider[];
}

export interface MvFlightSearchRequest {
    flightType: number;
    flightClass: number;
    adults: number;
    children: number;
    infants: number;
    email: string;
    departureLocation: string;
    arrivalLocation: string;
    departureDate: string;
    arrivalDate?: string;
    searchTrackingCode: string;
}

export interface GdsSearchResult {
    gds: string;
    data: any;
    error: string | null;
}
