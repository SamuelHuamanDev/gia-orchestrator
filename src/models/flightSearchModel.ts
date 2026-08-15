export interface FlightSearchParams {
    origen: string;
    destino: string;
    fechaSalida: string;
    fechaRetorno?: string;
    pasajeros?: number;
    clase?: string;
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
