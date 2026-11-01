'use client';

import { useEffect, useState } from 'react';
import type { GeoJSONSource, Map as MapboxMap, MapMouseEvent } from 'mapbox-gl';
import { loadMapbox, mapFont, removeLayers } from '@/lib/mapbox';
import type { ServiceLayerKind, ServiceLayers } from './types';
import { pointPopupContent } from './mapDom';
import { firstFeature, pointCoords } from './mapFeature';

interface PointsGeoJSON {
    type: 'FeatureCollection';
    features: { type: 'Feature'; geometry: { type: 'Point'; coordinates: [number, number] }; properties: Record<string, string> }[];
}

const cache = new Map<ServiceLayerKind, Promise<PointsGeoJSON>>();

function fetchPoints(kind: ServiceLayerKind): Promise<PointsGeoJSON> {
    let p = cache.get(kind);
    if (!p) {
        p = fetch(`/api/puntos?tipo=${kind}`).then(async (res) => {
            if (!res.ok) throw new Error(String(res.status));
            return (await res.json()) as PointsGeoJSON;
        });
        p.catch(() => cache.delete(kind));
        cache.set(kind, p);
    }
    return p;
}

const LABEL: Record<ServiceLayerKind, string> = {
    recarga: 'Punto de recarga TuLlave',
    personalizacion: 'Punto de personalización TuLlave',
};

/**
 * TuLlave service points as clustered layers. Recharge points are small light
 * discs; personalization centers are dark discs with a light ring.
 */
export function usePointsLayer(map: MapboxMap | null, ready: boolean, layers: ServiceLayers, darkPreset: boolean) {
    const [status, setStatus] = useState<Record<ServiceLayerKind, 'idle' | 'loading' | 'ready' | 'error'>>({ recarga: 'idle', personalizacion: 'idle' });

    useEffect(() => {
        if (!map || !ready) return;
        const kinds = (Object.keys(layers) as ServiceLayerKind[]).filter((k) => layers[k]);
        let cancelled = false;
        const cleanups: (() => void)[] = [];

        for (const kind of kinds) {
            const src = `pt-${kind}`;
            const ids = { clusters: `pt-${kind}-clusters`, count: `pt-${kind}-count`, points: `pt-${kind}-points` };
            Promise.resolve().then(() => { if (!cancelled) setStatus((s) => ({ ...s, [kind]: 'loading' })); });

            fetchPoints(kind)
                .then((data) => {
                    if (cancelled) return;
                    removeLayers(map, Object.values(ids), [src]);
                    map.addSource(src, { type: 'geojson', data, cluster: true, clusterMaxZoom: 15, clusterRadius: 40 });
                    const isRecarga = kind === 'recarga';
                    const fill = isRecarga ? '#e5e5e5' : '#0a0a0a';
                    const ring = isRecarga ? '#0a0a0a' : '#fafafa';
                    map.addLayer({
                        id: ids.clusters, type: 'circle', source: src, slot: 'top', filter: ['has', 'point_count'],
                        paint: {
                            'circle-color': fill,
                            'circle-radius': ['step', ['get', 'point_count'], 12, 25, 16, 100, 20],
                            'circle-stroke-color': ring,
                            'circle-stroke-width': 2,
                            'circle-emissive-strength': 1,
                        },
                    });
                    map.addLayer({
                        id: ids.count, type: 'symbol', source: src, slot: 'top', filter: ['has', 'point_count'],
                        layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-size': 11, 'text-font': mapFont(), 'text-allow-overlap': true },
                        paint: { 'text-color': ring, 'text-emissive-strength': 1 },
                    });
                    map.addLayer({
                        id: ids.points, type: 'circle', source: src, slot: 'top', filter: ['!', ['has', 'point_count']],
                        paint: {
                            'circle-color': fill,
                            'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 3.5, 16, 7],
                            'circle-stroke-color': ring,
                            'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 12, 1.5, 16, 2.5],
                            'circle-emissive-strength': 1,
                        },
                    });

                    const onCluster = (e: MapMouseEvent) => {
                        const id = Number(firstFeature(e)?.properties?.cluster_id);
                        if (!Number.isFinite(id)) return;
                        (map.getSource(src) as GeoJSONSource).getClusterExpansionZoom(id, (err, zoom) => {
                            if (!err && zoom != null) map.easeTo({ center: e.lngLat, zoom: zoom + 0.3, duration: 600 });
                        });
                    };
                    const onPoint = (e: MapMouseEvent) => {
                        const f = firstFeature(e);
                        const coords = pointCoords(f);
                        if (!f || !coords) return;
                        loadMapbox().then((mapboxgl) => {
                            new mapboxgl.Popup({ offset: 12, maxWidth: '260px' })
                                .setLngLat(coords)
                                .setDOMContent(pointPopupContent((f.properties || {}) as Record<string, string>, LABEL[kind]))
                                .addTo(map);
                        });
                    };
                    const enter = () => { map.getCanvas().style.cursor = 'pointer'; };
                    const leave = () => { map.getCanvas().style.cursor = ''; };
                    map.on('click', ids.clusters, onCluster);
                    map.on('click', ids.points, onPoint);
                    map.on('mouseenter', ids.points, enter);
                    map.on('mouseleave', ids.points, leave);
                    map.on('mouseenter', ids.clusters, enter);
                    map.on('mouseleave', ids.clusters, leave);
                    cleanups.push(() => {
                        map.off('click', ids.clusters, onCluster);
                        map.off('click', ids.points, onPoint);
                        map.off('mouseenter', ids.points, enter);
                        map.off('mouseleave', ids.points, leave);
                        map.off('mouseenter', ids.clusters, enter);
                        map.off('mouseleave', ids.clusters, leave);
                    });
                    setStatus((s) => ({ ...s, [kind]: 'ready' }));
                })
                .catch(() => {
                    if (!cancelled) setStatus((s) => ({ ...s, [kind]: 'error' }));
                });

            cleanups.push(() => removeLayers(map, Object.values(ids), [src]));
        }

        return () => {
            cancelled = true;
            try { cleanups.forEach((fn) => fn()); } catch { /* map removed */ }
        };
    }, [map, ready, layers, darkPreset]);

    return status;
}
