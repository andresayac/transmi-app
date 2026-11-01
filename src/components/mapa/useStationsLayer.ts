'use client';

import { useEffect, useRef } from 'react';
import type { GeoJSONSource, Map as MapboxMap, MapMouseEvent, Popup } from 'mapbox-gl';
import { loadMapbox, mapFont, removeLayers } from '@/lib/mapbox';
import type { StationMapEntry } from '@/types/station';
import { tooltipContent } from './mapDom';
import { firstFeature, pointCoords } from './mapFeature';

const SRC = 'ex-stations';
const L = {
    clusters: 'ex-clusters',
    count: 'ex-cluster-count',
    glow: 'ex-glow',
    zonal: 'ex-zonal',
    troncal: 'ex-troncal',
    selected: 'ex-selected',
};
const STATION_ICON = 'tm-station-square';

/** A rounded white square with a black border — TransMilenio stations read like signage tiles. */
function stationIcon(): ImageData | null {
    const ratio = 2;
    const size = 16 * ratio;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const r = 4 * ratio, lw = 3 * ratio, o = lw / 2;
    ctx.beginPath();
    ctx.roundRect(o, o, size - lw, size - lw, r);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = lw;
    ctx.strokeStyle = '#0a0a0a';
    ctx.stroke();
    return ctx.getImageData(0, 0, size, size);
}

function toFeatures(stations: StationMapEntry[], nearIds: Set<string>) {
    return {
        type: 'FeatureCollection' as const,
        features: stations.map((s) => ({
            type: 'Feature' as const,
            geometry: { type: 'Point' as const, coordinates: [s.lng, s.lat] },
            properties: {
                id: s.id,
                nombre: s.nombre,
                troncal: s.sistema === 'TransMilenio' ? 1 : 0,
                near: nearIds.has(s.id) ? 1 : 0,
            },
        })),
    };
}

/**
 * All stations and zonal stops, clustered. Color stays reserved for routes:
 * troncal stations are white tiles, zonal stops small grey dots.
 */
export function useStationsLayer(
    map: MapboxMap | null,
    ready: boolean,
    stations: StationMapEntry[],
    nearIds: Set<string>,
    darkPreset: boolean,
    selectedId: string | null,
    onSelect: (station: StationMapEntry) => void,
) {
    const byId = useRef(new Map<string, StationMapEntry>());
    const onSelectRef = useRef(onSelect);
    useEffect(() => {
        onSelectRef.current = onSelect;
    }, [onSelect]);

    // Layers and handlers: once per map (and when the light preset flips)
    useEffect(() => {
        if (!map || !ready) return;
        let popup: Popup | null = null;
        let cancelled = false;

        if (!map.hasImage(STATION_ICON)) {
            const icon = stationIcon();
            if (icon) map.addImage(STATION_ICON, icon, { pixelRatio: 2 });
        }

        removeLayers(map, Object.values(L), [SRC]);
        map.addSource(SRC, { type: 'geojson', data: { type: 'FeatureCollection', features: [] }, cluster: true, clusterMaxZoom: 13, clusterRadius: 48 });

        const fill = darkPreset ? '#262626' : '#fafafa';
        const ink = darkPreset ? '#fafafa' : '#171717';

        map.addLayer({
            id: L.clusters, type: 'circle', source: SRC, slot: 'top', filter: ['has', 'point_count'],
            paint: {
                'circle-color': fill,
                'circle-radius': ['step', ['get', 'point_count'], 16, 20, 21, 100, 27],
                'circle-stroke-color': ink,
                'circle-stroke-width': 1.5,
                'circle-stroke-opacity': 0.35,
                'circle-emissive-strength': 1,
            },
        });
        map.addLayer({
            id: L.count, type: 'symbol', source: SRC, slot: 'top', filter: ['has', 'point_count'],
            layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-size': 12, 'text-font': mapFont(), 'text-allow-overlap': true },
            paint: { 'text-color': ink, 'text-emissive-strength': 1 },
        });
        map.addLayer({
            id: L.glow, type: 'circle', source: SRC, slot: 'top', filter: ['all', ['!', ['has', 'point_count']], ['==', ['get', 'near'], 1]],
            paint: { 'circle-radius': 18, 'circle-color': ink, 'circle-opacity': 0.16, 'circle-blur': 0.7, 'circle-emissive-strength': 1 },
        });
        map.addLayer({
            id: L.zonal, type: 'circle', source: SRC, slot: 'top', filter: ['all', ['!', ['has', 'point_count']], ['==', ['get', 'troncal'], 0]],
            paint: {
                'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 2.5, 16, 5],
                'circle-color': '#a3a3a3',
                'circle-stroke-color': darkPreset ? '#000000' : '#ffffff',
                'circle-stroke-width': 1,
                'circle-emissive-strength': 1,
            },
        });
        map.addLayer({
            id: L.troncal, type: 'symbol', source: SRC, slot: 'top', filter: ['all', ['!', ['has', 'point_count']], ['==', ['get', 'troncal'], 1]],
            layout: {
                'icon-image': STATION_ICON,
                'icon-size': ['interpolate', ['linear'], ['zoom'], 11, 0.7, 15, 1.1, 17, 1.35],
                'icon-allow-overlap': true,
                'text-field': ['step', ['zoom'], '', 14.5, ['get', 'nombre']],
                'text-font': mapFont(),
                'text-size': 12,
                'text-offset': [0, 1.3],
                'text-anchor': 'top',
                'text-optional': true,
            },
            paint: {
                'text-color': ink,
                'text-halo-color': darkPreset ? '#000000' : '#ffffff',
                'text-halo-width': 1.4,
                'icon-emissive-strength': 1,
                'text-emissive-strength': 1,
            },
        });
        map.addLayer({
            id: L.selected, type: 'circle', source: SRC, slot: 'top',
            filter: ['==', ['get', 'id'], '__none__'],
            paint: { 'circle-radius': 15, 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': ink, 'circle-stroke-width': 3, 'circle-emissive-strength': 1 },
        });

        const onCluster = (e: MapMouseEvent) => {
            const f = firstFeature(e);
            const clusterId = Number(f?.properties?.cluster_id);
            if (!f || !Number.isFinite(clusterId)) return;
            (map.getSource(SRC) as GeoJSONSource).getClusterExpansionZoom(clusterId, (err, zoom) => {
                if (err || zoom == null) return;
                map.easeTo({ center: e.lngLat, zoom: zoom + 0.3, duration: 600 });
            });
        };
        const onStation = (e: MapMouseEvent) => {
            const id = String(firstFeature(e)?.properties?.id ?? '');
            const s = byId.current.get(id);
            if (s) onSelectRef.current(s);
        };
        const onEnter = (e: MapMouseEvent) => {
            map.getCanvas().style.cursor = 'pointer';
            const f = firstFeature(e);
            const coords = pointCoords(f);
            if (!f || f.properties?.cluster || !coords) return;
            const name = String(f.properties?.nombre ?? '');
            loadMapbox().then((mapboxgl) => {
                if (cancelled) return;
                popup?.remove();
                popup = new mapboxgl.Popup({ closeButton: false, closeOnClick: false, offset: 12, className: 'station-tooltip' })
                    .setLngLat(coords)
                    .setDOMContent(tooltipContent(name))
                    .addTo(map);
            });
        };
        const onLeave = () => {
            map.getCanvas().style.cursor = '';
            popup?.remove();
            popup = null;
        };

        map.on('click', L.clusters, onCluster);
        map.on('click', L.troncal, onStation);
        map.on('click', L.zonal, onStation);
        map.on('mouseenter', L.clusters, onLeave);
        map.on('mouseenter', L.troncal, onEnter);
        map.on('mouseenter', L.zonal, onEnter);
        map.on('mouseleave', L.troncal, onLeave);
        map.on('mouseleave', L.zonal, onLeave);
        map.on('mouseleave', L.clusters, onLeave);

        return () => {
            cancelled = true;
            popup?.remove();
            try {
                map.off('click', L.clusters, onCluster);
                map.off('click', L.troncal, onStation);
                map.off('click', L.zonal, onStation);
                map.off('mouseenter', L.clusters, onLeave);
                map.off('mouseenter', L.troncal, onEnter);
                map.off('mouseenter', L.zonal, onEnter);
                map.off('mouseleave', L.troncal, onLeave);
                map.off('mouseleave', L.zonal, onLeave);
                map.off('mouseleave', L.clusters, onLeave);
                removeLayers(map, Object.values(L), [SRC]);
            } catch { /* map removed */ }
        };
    }, [map, ready, darkPreset]);

    // Data: cheap updates through setData
    useEffect(() => {
        if (!map || !ready) return;
        byId.current = new Map(stations.map((s) => [s.id, s]));
        const src = map.getSource(SRC) as GeoJSONSource | undefined;
        src?.setData(toFeatures(stations, nearIds));
    }, [map, ready, stations, nearIds, darkPreset]);

    // Selected ring
    useEffect(() => {
        if (!map || !ready || !map.getLayer(L.selected)) return;
        map.setFilter(L.selected, ['all', ['!', ['has', 'point_count']], ['==', ['get', 'id'], selectedId ?? '__none__']]);
    }, [map, ready, selectedId, darkPreset]);
}
