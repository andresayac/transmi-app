import type { MapMouseEvent } from 'mapbox-gl';

/**
 * Minimal view of a rendered feature. The `GeoJSON` namespace mapbox-gl's typings
 * rely on (@types/geojson) is not hoisted by pnpm here, so we read features through this shape.
 */
export interface FeatureLike {
    properties?: Record<string, string | number | boolean | null | undefined> | null;
    geometry?: { type: string; coordinates?: unknown };
}

export function firstFeature(e: MapMouseEvent): FeatureLike | null {
    return (e.features?.[0] as unknown as FeatureLike | undefined) ?? null;
}

export function pointCoords(f: FeatureLike | null): [number, number] | null {
    const c = f?.geometry?.coordinates;
    return Array.isArray(c) && typeof c[0] === 'number' && typeof c[1] === 'number' ? [c[0], c[1]] : null;
}
