'use client';

import { visibleOnMap } from '@/lib/color';
import { useEffect, useMemo, useRef } from 'react';
import type { Map as MapboxMap, MapMouseEvent } from 'mapbox-gl';
import { removeLayers } from '@/lib/mapbox';
import { firstFeature } from './mapFeature';
import type { MapRoute } from './types';
import { isDesktop, SIDE_PANEL_SPACE } from '@/lib/layout';

const HIGHLIGHT_SRC = 'rl-highlight';
const HIGHLIGHT_LAYERS = ['rl-highlight-halo', 'rl-highlight-dot'];

interface Options {
    darkPreset: boolean;
    onStopClick?: (routeKey: string, stopIndex: number) => void;
    highlight?: { routeKey: string; stopIndex: number } | null;
}

function idsFor(key: string) {
    return {
        lineSrc: `rl-line-src-${key}`,
        stopsSrc: `rl-stops-src-${key}`,
        casing: `rl-casing-${key}`,
        line: `rl-line-${key}`,
        stops: `rl-stops-${key}`,
    };
}

/**
 * Draws each visible route with its real geometry (dark/light casing under the
 * route color) and its stops as station ticks, plus a ring on the selected stop.
 */
export function useRouteLayers(map: MapboxMap | null, ready: boolean, routes: MapRoute[], { darkPreset, onStopClick, highlight }: Options) {
    const onStopClickRef = useRef(onStopClick);
    useEffect(() => {
        onStopClickRef.current = onStopClick;
    }, [onStopClick]);

    const drawable = useMemo(() => routes.filter((r) => r.visible && r.detail), [routes]);
    const signature = drawable.map((r) => `${r.key}:${r.color}:${r.detail!.stops.length}:${r.detail!.geometry.length}`).join('|');

    useEffect(() => {
        if (!map || !ready) return;
        const added: ReturnType<typeof idsFor>[] = [];
        const handlers: { layer: string; type: 'click' | 'mouseenter' | 'mouseleave'; fn: (e: MapMouseEvent) => void }[] = [];
        const casingColor = darkPreset ? '#000000' : '#ffffff';

        for (const route of drawable) {
            const d = route.detail!;
            const ids = idsFor(route.key);
            removeLayers(map, [ids.stops, ids.line, ids.casing], [ids.lineSrc, ids.stopsSrc]);

            map.addSource(ids.lineSrc, {
                type: 'geojson',
                data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: d.geometry } },
            });
            map.addSource(ids.stopsSrc, {
                type: 'geojson',
                data: {
                    type: 'FeatureCollection',
                    features: d.stops.map((s, i) => ({
                        type: 'Feature' as const,
                        geometry: { type: 'Point' as const, coordinates: [s.lng, s.lat] },
                        properties: { i, portal: s.isPortal ? 1 : 0, active: s.active ? 1 : 0, name: s.name },
                    })),
                },
            });

            map.addLayer({
                id: ids.casing,
                type: 'line',
                source: ids.lineSrc,
                slot: 'middle',
                layout: { 'line-join': 'round', 'line-cap': 'round' },
                paint: {
                    'line-color': casingColor,
                    'line-opacity': 0.85,
                    'line-width': ['interpolate', ['linear'], ['zoom'], 10, 5, 14, 9, 17, 15],
                },
            });
            map.addLayer({
                id: ids.line,
                type: 'line',
                source: ids.lineSrc,
                slot: 'middle',
                layout: { 'line-join': 'round', 'line-cap': 'round' },
                paint: {
                    'line-color': visibleOnMap(route.color, darkPreset),
                    'line-width': ['interpolate', ['linear'], ['zoom'], 10, 2.5, 14, 5, 17, 9],
                    'line-emissive-strength': 1,
                },
            });
            map.addLayer({
                id: ids.stops,
                type: 'circle',
                source: ids.stopsSrc,
                slot: 'top',
                paint: {
                    'circle-radius': [
                        'interpolate', ['linear'], ['zoom'],
                        10, ['case', ['==', ['get', 'portal'], 1], 4.5, 2.5],
                        14, ['case', ['==', ['get', 'portal'], 1], 8, 5],
                        17, ['case', ['==', ['get', 'portal'], 1], 11, 7.5],
                    ],
                    'circle-color': ['case', ['==', ['get', 'active'], 1], '#ffffff', '#9ca3af'],
                    'circle-stroke-color': route.color,
                    'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 10, 1.5, 15, 3],
                    'circle-emissive-strength': 1,
                },
            });
            added.push(ids);

            const click = (e: MapMouseEvent) => {
                const i = Number(firstFeature(e)?.properties?.i);
                if (Number.isFinite(i)) onStopClickRef.current?.(route.key, i);
            };
            const enter = () => { map.getCanvas().style.cursor = 'pointer'; };
            const leave = () => { map.getCanvas().style.cursor = ''; };
            map.on('click', ids.stops, click);
            map.on('mouseenter', ids.stops, enter);
            map.on('mouseleave', ids.stops, leave);
            handlers.push({ layer: ids.stops, type: 'click', fn: click }, { layer: ids.stops, type: 'mouseenter', fn: enter }, { layer: ids.stops, type: 'mouseleave', fn: leave });
        }

        return () => {
            for (const h of handlers) {
                try { map.off(h.type, h.layer, h.fn); } catch { /* map removed */ }
            }
            for (const ids of added) {
                try { removeLayers(map, [ids.stops, ids.line, ids.casing], [ids.lineSrc, ids.stopsSrc]); } catch { /* map removed */ }
            }
        };
        // `signature` captures the drawable routes' identity; `drawable` itself changes on every bus poll.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [map, ready, signature, darkPreset]);

    // Selected stop ring
    const highlightTarget = useMemo(() => {
        if (!highlight) return null;
        const route = routes.find((r) => r.key === highlight.routeKey);
        const stop = route?.detail?.stops[highlight.stopIndex];
        return stop && route ? { lng: stop.lng, lat: stop.lat, color: route.color } : null;
    }, [highlight, routes]);

    useEffect(() => {
        if (!map || !ready) return;
        removeLayers(map, HIGHLIGHT_LAYERS, [HIGHLIGHT_SRC]);
        if (!highlightTarget) return;
        map.addSource(HIGHLIGHT_SRC, {
            type: 'geojson',
            data: { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [highlightTarget.lng, highlightTarget.lat] } },
        });
        map.addLayer({
            id: HIGHLIGHT_LAYERS[0],
            type: 'circle',
            source: HIGHLIGHT_SRC,
            slot: 'top',
            paint: { 'circle-radius': 18, 'circle-color': highlightTarget.color, 'circle-opacity': 0.25, 'circle-emissive-strength': 1 },
        });
        map.addLayer({
            id: HIGHLIGHT_LAYERS[1],
            type: 'circle',
            source: HIGHLIGHT_SRC,
            slot: 'top',
            paint: {
                'circle-radius': 9,
                'circle-color': highlightTarget.color,
                'circle-stroke-color': '#ffffff',
                'circle-stroke-width': 3,
                'circle-emissive-strength': 1,
            },
        });
        return () => {
            try { removeLayers(map, HIGHLIGHT_LAYERS, [HIGHLIGHT_SRC]); } catch { /* map removed */ }
        };
    }, [map, ready, highlightTarget]);
}

/** Fit the camera to the given routes, leaving room for the bottom sheet (or the side panel on computers). */
export function fitRoutes(map: MapboxMap, routes: MapRoute[], bottomPadding = 260) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const r of routes) {
        for (const [x, y] of r.detail?.geometry || []) {
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x > maxX) maxX = x;
            if (y > maxY) maxY = y;
        }
    }
    if (!Number.isFinite(minX)) return;
    const h = map.getContainer().clientHeight;
    map.fitBounds([[minX, minY], [maxX, maxY]], {
        padding: isDesktop()
            ? { top: 60, bottom: 60, left: SIDE_PANEL_SPACE + 40, right: 80 }
            : { top: 90, bottom: Math.min(bottomPadding, h * 0.55), left: 40, right: 64 },
        pitch: 40,
        bearing: -12,
        duration: 1100,
        maxZoom: 16,
    });
}
