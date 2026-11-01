'use client';

import 'mapbox-gl/dist/mapbox-gl.css';
import type { Map as MapboxMap, MapOptions } from 'mapbox-gl';
import { dayPeriod } from '@/lib/schedule';
import { MAPBOX_TOKEN, BOGOTA_CENTER } from '@/utils/constants';

export type MapboxGL = typeof import('mapbox-gl').default;
export type LightPreset = 'dawn' | 'day' | 'dusk' | 'night';
export type MapLightPref = 'auto' | 'day' | 'night';

let lib: Promise<MapboxGL> | null = null;

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

/**
 * Mapbox Standard in its monochrome theme — the city in black and white, so the
 * only color on the map is the transit data drawn on top of it.
 */
export async function createMap({ container, center = BOGOTA_CENTER, zoom = 12, pitch = 45, bearing = -12, light = 'auto', interactive = true, extra }: CreateMapOptions): Promise<MapboxMap> {
    const mapboxgl = await loadMapbox();
    const map = new mapboxgl.Map({
        container,
        style: 'mapbox://styles/mapbox/standard',
        config: {
            basemap: {
                theme: 'monochrome',
                lightPreset: lightPresetFor(light),
                showPointOfInterestLabels: false,
                showTransitLabels: false,
                show3dObjects: true,
            },
        },
        center,
        zoom,
        pitch,
        bearing,
        interactive,
        attributionControl: false,
        antialias: true,
        ...extra,
    });
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-left');
    return map;
}

export function setMapLight(map: MapboxMap, pref: MapLightPref) {
    try {
        map.setConfigProperty('basemap', 'lightPreset', lightPresetFor(pref));
    } catch { /* style not ready yet */ }
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
