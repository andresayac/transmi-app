import type { RouteDetailNormalized } from '@/types/transit';

/** A route as shown on the map: identity, the color it is drawn with, and its loaded detail. */
export interface MapRoute {
    /** Stable key (route id) */
    key: string;
    id: string;
    codigo: string;
    nombre: string;
    tipoServicio: string;
    /** Color used to draw it (real color in single mode, comparison color in multi mode) */
    color: string;
    /** The route's own color, for its badge */
    originalColor: string;
    visible: boolean;
    detail: RouteDetailNormalized | null;
    status: 'loading' | 'ready' | 'error';
}

/** Shape stored in sessionStorage('multiRoutes') by search, favorites, catalog and station sheets. */
export interface StoredMultiRoute {
    id: string;
    codigo: string;
    nombre: string;
    tipoServicio: string;
    color: string;
    originalColor: string;
}

export type ServiceLayerKind = 'recarga' | 'personalizacion';
export type ServiceLayers = Record<ServiceLayerKind, boolean>;
