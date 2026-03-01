export interface Troncal {
    id: string;
    letra: string;
    nombre: string;
    color: string;
    ruta_esquema_pdf: string | null;
}

export interface Estacion {
    id: string;
    codigo: string;
    nombre: string;
    direccion: string;
    coordenada?: string;
    sistema?: string | null;
}

export interface ZonaOperacional {
    id: string;
    nombre: string;
    estado: string;
    nombreZonal: string;
    correo: string;
    cantiad: string; // typo from API
}

export interface Parada {
    id: string;
    codigo: string;
    nombre: string;
    nombreSinTilde: string;
    direccion: string;
    coordenada: string;
    sistema: string;
}

export interface BusETA {
    vehicleid: number;
    etiqueta: string;
    lasttime: string;
    acessiblidad: string;
    estadobus: string;
    longitud: number;
    latitud: number;
    posicion: number;
    time: number;
    distancia: number;
    labeltiempo: string;
    angulo: number;
    ruta_extraida: string;
    destino_limpio: string;
    estacion_parada: string;
}
