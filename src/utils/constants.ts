export const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

export const BOGOTA_CENTER: [number, number] = [-74.1, 4.65];
export const DEFAULT_ZOOM = 12;

export const ROUTE_COLORS = [
    '#ef4444', // red
    '#10b981', // emerald
    '#f59e0b', // amber
    '#8b5cf6', // violet
    '#06b6d4', // cyan
    '#ec4899', // pink
    '#14b8a6', // teal
    '#f97316', // orange
    '#84cc16', // lime
    '#0ea5e9', // sky
    '#f43f5e', // rose
    '#6366f1', // indigo
];

export const ROUTE_TYPE_ICONS: Record<string, string> = {
    'Troncal': '🚊',
    'Troncales': '🚊',
    'Alimentadoras': '🚐',
    'Alimentador': '🚐',
    'Urbanas': '🚌',
    'Urbana': '🚌',
    'TransMiZonal': '🚌',
    'TransMiCable': '🚡',
    'TransMilenio': '🚊',
};

export const BUS_IMAGES: Record<string, string> = {
    'Troncales': 'point_transmi.png',
    'TransMilenio': 'point_transmi.png',
    'Alimentadoras': 'point_alimentador.png',
    'Alimentador': 'point_alimentador.png',
    'Urbanas': 'point_sitp.png',
    'Urbana': 'point_sitp.png',
    'TransMiZonal': 'point_sitp.png',
};

export const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
export const BUS_CACHE_TTL = 10 * 1000; // 10 seconds
export const BUS_POLL_INTERVAL = 6000; // 6 seconds
