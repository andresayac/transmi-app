export interface StationMapEntry {
    id: string;
    codigo: string;
    nombre: string;
    direccion: string;
    lat: number;
    lng: number;
    sistema: string;
}

export interface StationCache {
    stations: StationMapEntry[];
    timestamp: number;
}
