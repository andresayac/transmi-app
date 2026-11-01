import type { LngLat } from '@/lib/geo';

// ─── Trip planner ────────────────────────────────────────

export interface PlanPlace {
    name: string;
    lat: number;
    lng: number;
    /** Secondary line (address, locality) */
    detail?: string;
    kind?: 'gps' | 'home' | 'work' | 'saved' | 'station' | 'place' | 'map';
}

export interface PlanStop {
    id: string;
    code: string;
    name: string;
    lat: number;
    lng: number;
}

export interface PlanLine {
    id: string;
    code: string;
    name: string;
    longName: string;
    color: string;
    agency: string;
    /** "troncal" | "zonal" | "alimentador" | "cable" */
    kind: 'troncal' | 'zonal' | 'alimentador' | 'cable';
}

export interface PlanLeg {
    mode: 'WALK' | 'TRANSIT';
    durationMin: number;
    distanceM: number;
    distanceText: string;
    from: PlanStop;
    to: PlanStop;
    geometry: LngLat[];
    line?: PlanLine;
    /** Intermediate stops, excluding from/to */
    stops?: PlanStop[];
    suspendedStops?: number;
}

export interface Itinerary {
    id: string;
    durationMin: number;
    walkMeters: number;
    walkMin: number;
    transfers: number;
    legs: PlanLeg[];
    bounds: [LngLat, LngLat] | null;
    tags: ItineraryTag[];
}

export type ItineraryTag = 'fastest' | 'fewest-transfers' | 'least-walking';

export interface PlanResponse {
    itineraries: Itinerary[];
    from: PlanPlace;
    to: PlanPlace;
    requestedAt: string;
}

// ─── Live arrivals ───────────────────────────────────────

export interface Arrival {
    routeId: number;
    code: string;
    destination: string;
    /** Raw label from API, e.g. "Entre 4 y 6 min" / "Servicio llegando" */
    label: string;
    /** Best-effort minutes (lower bound), 0 = arriving, null = unknown */
    minutes: number | null;
    distanceLabel: string;
    color: string;
    textColor: string;
}

export interface ArrivalsResponse {
    stop: string;
    arrivals: Arrival[];
    updatedAt: string;
}

// ─── Live buses ──────────────────────────────────────────

export type Occupancy = 'VACIO' | 'MEDIO' | 'LLENO' | 'DESCONOCIDO';

export interface LiveBus {
    id: string;
    label: string;
    lat: number;
    lng: number;
    bearing: number;
    destination: string;
    occupancy: Occupancy;
    accessibility: string;
    status: string;
    lastSeen: string;
    /** Meters along the route as reported by the API (0 when unknown) */
    position: number;
}

export interface StopEta {
    vehicleId: number;
    label: string;
    minutes: number;
    distanceM: number;
    occupancy: Occupancy;
    accessibility: string;
    destination: string;
    lat: number;
    lng: number;
}

// ─── Route detail ────────────────────────────────────────

export interface RouteStopDetail {
    id: string;
    code: string;
    name: string;
    address: string;
    lat: number;
    lng: number;
    /** Meters along the route */
    position: number;
    platform?: string;
    active: boolean;
    isPortal: boolean;
}

export interface RouteDetailNormalized {
    id: string;
    code: string;
    name: string;
    color: string;
    system: string;
    serviceType: string;
    schedules: { convencion: string; hora_inicio: string; hora_fin: string }[];
    stops: RouteStopDetail[];
    geometry: LngLat[];
}

// ─── Points of interest ──────────────────────────────────

export interface ServicePoint {
    name: string;
    address: string;
    lat: number;
    lng: number;
    locality: string;
    /** Opening hours: weekdays / saturdays / sundays-holidays */
    hours: { wk: string; sat: string; hol: string };
    distanceM?: number;
}

// ─── Weather ─────────────────────────────────────────────

export interface WeatherNow {
    temperature: number;
    code: number;
    isDay: boolean;
    precipitation: number;
    /** Minutes until rain starts in the next 2h, 0 = raining now, null = no rain expected */
    rainInMin: number | null;
    rainProbability: number;
    summary: string;
}
