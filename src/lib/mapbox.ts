'use client';

// mapbox-gl.css is imported from globals.css inside a cascade layer (see there)
import type { Map as MapboxMap, MapOptions } from 'mapbox-gl';
import { dayPeriod } from '@/lib/schedule';
import { MAPBOX_TOKEN, BOGOTA_CENTER } from '@/utils/constants';
import { isDataSaver } from '@/lib/dataSaver';

export type MapboxGL = typeof import('mapbox-gl').default;
export type LightPreset = 'dawn' | 'day' | 'dusk' | 'night';
export type MapLightPref = 'auto' | 'day' | 'night';

/**
 * Basemap provider. "mapbox" is the Standard style (monochrome, 3D, light presets).
 * "openfreemap" is a key-less fallback (OpenStreetMap vector tiles) used when the
 * Mapbox token can't load tiles (403: domain restriction, scopes or billing).
 */
export type MapProvider = 'mapbox' | 'openfreemap';

let lib: Promise<MapboxGL> | null = null;
let provider: MapProvider = 'mapbox';

/** Lazy-load mapbox-gl once (keeps it out of pages that don't show a map). */
export function loadMapbox(): Promise<MapboxGL> {
    if (!lib) {
        lib = import('mapbox-gl').then((m) => {
            const mapboxgl = m.default;
            mapboxgl.accessToken = MAPBOX_TOKEN;
            return mapboxgl;
        });
    }
    return lib;
}

const PROVIDER_KEY = 'transmi-map-provider';

/** Basemap for new maps: env override, else what this session learned, else Mapbox. */
export function resolveProvider(): MapProvider {
    const forced = process.env.NEXT_PUBLIC_MAP_PROVIDER as MapProvider | undefined;
    if (forced === 'mapbox' || forced === 'openfreemap') return (provider = forced);
    if (!MAPBOX_TOKEN) return (provider = 'openfreemap');
    try {
        if (sessionStorage.getItem(PROVIDER_KEY) === 'openfreemap') return (provider = 'openfreemap');
    } catch { /* storage unavailable */ }
    return provider;
}

function markMapboxUnavailable() {
    provider = 'openfreemap';
    try { sessionStorage.setItem(PROVIDER_KEY, 'openfreemap'); } catch { /* ignore */ }
    console.warn('[mapa] Mapbox rechazó las teselas (403): revisa el token o la cuenta. Usando OpenFreeMap como mapa base.');
}

export function currentProvider(): MapProvider {
    return provider;
}

/** Font stack for symbol layers, valid for the active basemap's glyph server. */
export function mapFont(weight: 'regular' | 'bold' = 'bold'): string[] {
    if (provider === 'openfreemap') return [weight === 'bold' ? 'Noto Sans Bold' : 'Noto Sans Regular'];
    return [weight === 'bold' ? 'DIN Pro Medium' : 'DIN Pro Regular', 'Arial Unicode MS Regular'];
}

/** Map light follows the real sky over Bogotá unless the user pinned day or night. */
export function lightPresetFor(pref: MapLightPref = 'auto'): LightPreset {
    if (pref === 'day') return 'day';
    if (pref === 'night') return 'night';
    return dayPeriod();
}

export interface CreateMapOptions {
    container: HTMLElement;
    center?: [number, number];
    zoom?: number;
    pitch?: number;
    bearing?: number;
    light?: MapLightPref;
    interactive?: boolean;
    /** Extra Mapbox options */
    extra?: Partial<MapOptions>;
}

const OFM_STYLE = (preset: LightPreset) => `https://tiles.openfreemap.org/styles/${isDarkPreset(preset) ? 'dark' : 'positron'}`;

/** Fallback basemap: extrude OpenStreetMap buildings so the city still reads in 3D. */
function addOpenFreeMap3D(map: MapboxMap, preset: LightPreset) {
    try {
        if (map.getLayer('ofm-3d-buildings') || !map.getSource('openmaptiles')) return;
        map.addLayer({
            id: 'ofm-3d-buildings',
            type: 'fill-extrusion',
            source: 'openmaptiles',
            'source-layer': 'building',
            minzoom: 14,
            paint: {
                'fill-extrusion-color': isDarkPreset(preset) ? '#1c1c1c' : '#e4e4e4',
                'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 8],
                'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
                'fill-extrusion-opacity': 0.85,
            },
        });
    } catch { /* style without building data */ }
}

/**
 * Mapbox Standard in its monochrome theme — the city in black and white, so the
 * only color on the map is the transit data drawn on top of it. Falls back to a
 * monochrome OpenStreetMap basemap when Mapbox tiles are not available.
 */
/**
 * Swap the basemap to OpenFreeMap without losing our data: every top-level source
 * and layer (Standard keeps its own basemap inside an import, so top-level means
 * "ours") is re-added once the new style loads. Delegated layer events and DOM
 * markers live outside the style and survive untouched.
 */
function swapToOpenFreeMap(map: MapboxMap, preset: LightPreset) {
    let style: ReturnType<MapboxMap['getStyle']> | null = null;
    try { style = map.getStyle(); } catch { /* style not parsed yet */ }
    const ownSources = Object.entries(style?.sources || {}).filter(([, s]) => (s as { type?: string }).type === 'geojson');
    const ownSourceIds = new Set(ownSources.map(([id]) => id));
    const ownLayers = (style?.layers || []).filter((l) => 'source' in l && typeof l.source === 'string' && ownSourceIds.has(l.source));

    map.setStyle(OFM_STYLE(preset), { diff: false } as Parameters<MapboxMap['setStyle']>[1]);
    map.once('style.load', () => {
        if (!isDataSaver()) addOpenFreeMap3D(map, preset);
        for (const [id, source] of ownSources) {
            try { if (!map.getSource(id)) map.addSource(id, source as Parameters<MapboxMap['addSource']>[1]); } catch { /* ignore */ }
        }
        for (const layer of ownLayers) {
            const { slot: _slot, ...rest } = layer as typeof layer & { slot?: string; layout?: Record<string, unknown> };
            void _slot;
            // Mapbox glyph fonts don't exist on the fallback glyph server
            if (rest.type === 'symbol' && rest.layout && 'text-font' in rest.layout) {
                rest.layout = { ...rest.layout, 'text-font': mapFont() };
            }
            try { if (!map.getLayer(layer.id)) map.addLayer(rest as Parameters<MapboxMap['addLayer']>[0]); } catch { /* ignore */ }
        }
    });
}

/** Fall back to OpenFreeMap if Mapbox starts refusing this token's tiles. */
function watchTileDenials(map: MapboxMap, preset: () => LightPreset) {
    let denied = 0;
    const onError = (e: { error: Error }) => {
        // Tile request failures carry the HTTP status on the error object
        const status = (e?.error as Error & { status?: number })?.status;
        if (status !== 401 && status !== 403) return;
        if (++denied < 3) return;
        stop();
        markMapboxUnavailable();
        swapToOpenFreeMap(map, preset());
    };
    const timer = setTimeout(() => stop(), 20000);
    function stop() {
        clearTimeout(timer);
        map.off('error', onError);
    }
    map.on('error', onError);
}

const presets = new WeakMap<MapboxMap, LightPreset>();

export async function createMap({ container, center = BOGOTA_CENTER, zoom = 12, pitch = 45, bearing = -12, light = 'auto', interactive = true, extra }: CreateMapOptions): Promise<MapboxMap> {
    const mapboxgl = await loadMapbox();
    const basemap = resolveProvider();
    const preset = lightPresetFor(light);
    // Data saver: flat map (tilting loads tiles up to the horizon) and no 3D models
    const flat = isDataSaver();

    const styleOptions: Partial<MapOptions> = basemap === 'mapbox'
        ? {
            style: 'mapbox://styles/mapbox/standard',
            config: {
                basemap: {
                    theme: 'monochrome',
                    lightPreset: preset,
                    showPointOfInterestLabels: false,
                    showTransitLabels: false,
                    show3dObjects: !flat,
                },
            },
        }
        : { style: OFM_STYLE(preset) };

    const map = new mapboxgl.Map({
        container,
        ...styleOptions,
        center,
        zoom,
        pitch: flat ? 0 : pitch,
        bearing,
        interactive,
        attributionControl: false,
        antialias: !flat,
        ...(flat ? { maxPitch: 0 } : {}),
        ...extra,
    } as MapOptions);
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-left');
    presets.set(map, preset);
    if (basemap === 'mapbox') watchTileDenials(map, () => presets.get(map) || preset);
    else if (!flat) map.once('style.load', () => addOpenFreeMap3D(map, preset));
    return map;
}

/**
 * Change the light preset. On the Standard style it's a config change; on the
 * fallback basemap it swaps between the light and dark styles, keeping our layers.
 */
export function setMapLight(map: MapboxMap, pref: MapLightPref) {
    const preset = lightPresetFor(pref);
    const previous = presets.get(map);
    presets.set(map, preset);
    if (provider === 'mapbox') {
        try {
            map.setConfigProperty('basemap', 'lightPreset', preset);
        } catch { /* style not ready yet */ }
        return;
    }
    if (previous && isDarkPreset(previous) !== isDarkPreset(preset)) swapToOpenFreeMap(map, preset);
}

/** Remove layers and their source if present (safe to call repeatedly). */
export function removeLayers(map: MapboxMap, layerIds: string[], sourceIds: string[] = []) {
    for (const id of layerIds) {
        try { if (map.getLayer(id)) map.removeLayer(id); } catch { /* ignore */ }
    }
    for (const id of sourceIds) {
        try { if (map.getSource(id)) map.removeSource(id); } catch { /* ignore */ }
    }
}

/** Night presets render dark: use light strokes/labels on top of them. */
export function isDarkPreset(preset: LightPreset) {
    return preset === 'night' || preset === 'dusk';
}
