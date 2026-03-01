export interface RouteSearchResult {
    id: string;
    codigo: string;
    nombre: string;
    tipoServicio: string;
    color: string;
    horarios?: {
        data: RouteSchedule[];
    };
}

export interface RouteSchedule {
    convencion: string;
    hora_inicio: string;
    hora_fin: string;
}

export interface RouteStop {
    nombre: string;
    direccion: string;
    codigo: string;
    coordenada: string;
    tipo_parada: string;
}

export interface RouteDetail {
    codigo: string;
    nombre: string;
    tipoServicio?: string;
    tipoRuta?: string;
    operadores?: string;
    estacion_destino?: string;
    horarios?: {
        data: RouteSchedule[];
    };
    recorrido?: {
        data: RouteStop[];
    };
    portal?: {
        nombre: string;
    };
    nombre_zona?: string;
}

export interface SelectedRoute extends RouteDetail {
    id: string;
    color: string;
}
