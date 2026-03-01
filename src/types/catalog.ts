export interface RouteCatalogEntry {
    id: string;
    codigo: string;
    nombre: string;
    tipoServicio: string;
    color: string;
    troncalId: string;
    troncalNombre: string;
    troncalColor: string;
    troncalLetra: string;
    estacionId: string;
    estacionNombre: string;
}

export interface RouteCatalog {
    entries: RouteCatalogEntry[];
    timestamp: number;
    troncalCount: number;
    estacionCount: number;
}

export interface CatalogProgress {
    phase: 'troncales' | 'estaciones' | 'rutas';
    loaded: number;
    total: number;
    label: string;
}
