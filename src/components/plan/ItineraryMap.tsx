'use client';

import { useEffect, useRef, useState } from 'react';
import type { Map as MapboxMap, Marker } from 'mapbox-gl';
import type { Itinerary, PlanPlace } from '@/types/transit';
import { createMap, isDarkPreset, lightPresetFor, loadMapbox, removeLayers, setMapLight } from '@/lib/mapbox';
import { visibleOnMap } from '@/lib/color';
import { useAppStore, useHydrated } from '@/stores/app';
import { useDataSaver } from '@/lib/dataSaver';
import RouteSketch from './RouteSketch';
import { cn } from '@/lib/utils';

export interface RiderPoint {
    lat: number;
    lng: number;
    heading: number | null;
}

export interface ItineraryMapProps {
    itinerary: Itinerary;
    from: PlanPlace;
    to: PlanPlace;
    rider?: RiderPoint | null;
    /** Keep the camera on the rider */
    follow?: boolean;
    /** Fired when the user pans the map by hand (used to pause following) */
    onUserMove?: () => void;
    /** Change this value to re-center (on the rider when following, else on the route) */
    recenterKey?: number;
    padding?: { top: number; bottom: number; left: number; right: number };
    className?: string;
}

const LAYERS = ['plan-walk', 'plan-ride-casing', 'plan-ride', 'plan-stops'];
const SOURCES = ['plan-walk', 'plan-ride', 'plan-stops'];

function endpointEl(kind: 'from' | 'to'): HTMLElement {
    const el = document.createElement('div');
    if (kind === 'from') {
        el.style.cssText = 'width:18px;height:18px;border-radius:9999px;background:#fff;border:5px solid #000;box-shadow:0 2px 8px rgba(0,0,0,.45)';
    } else {
        el.style.cssText = 'width:26px;height:26px;border-radius:8px 8px 8px 0;transform-origin:center;background:#000;border:3px solid #fff;box-shadow:0 2px 10px rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center';
        el.innerHTML = '<span style="width:8px;height:8px;border-radius:2px;background:#fff;display:block"></span>';
    }
    return el;
}

function riderEl(): HTMLElement {
    const el = document.createElement('div');
    el.style.cssText = 'width:44px;height:44px;position:relative;pointer-events:none';
    el.innerHTML = `
        <div data-cone style="position:absolute;inset:0;transition:transform .6s ease;opacity:0">
            <div style="position:absolute;left:50%;top:0;width:0;height:0;transform:translateX(-50%);border-left:11px solid transparent;border-right:11px solid transparent;border-bottom:20px solid rgba(255,255,255,.55);filter:drop-shadow(0 0 2px rgba(0,0,0,.6))"></div>
        </div>
        <div style="position:absolute;left:50%;top:50%;width:20px;height:20px;transform:translate(-50%,-50%);border-radius:9999px;background:#000;border:4px solid #fff;box-shadow:0 0 0 6px rgba(0,0,0,.18),0 2px 10px rgba(0,0,0,.5)"></div>`;
    return el;
}

/**
 * The itinerary on the monochrome map: walking as dotted neutral tracks,
 * rides as solid lines in their own color with a dark casing.
 */
function LiveMap({ itinerary, from, to, rider = null, follow = false, onUserMove, recenterKey = 0, padding, className }: ItineraryMapProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<MapboxMap | null>(null);
    const markersRef = useRef<Marker[]>([]);
    const riderRef = useRef<Marker | null>(null);
    const userMoveRef = useRef(onUserMove);
    const [ready, setReady] = useState(false);
    const mapLight = useAppStore((s) => s.settings.mapLight);
    const dark = isDarkPreset(lightPresetFor(mapLight));
    const pad = padding || { top: 70, bottom: 50, left: 50, right: 50 };
    const padKey = `${pad.top},${pad.bottom},${pad.left},${pad.right}`;

    useEffect(() => {
        userMoveRef.current = onUserMove;
    }, [onUserMove]);

    // Create the map once
    useEffect(() => {
        let cancelled = false;
        let map: MapboxMap | null = null;
        const container = containerRef.current;
        if (!container) return;
        createMap({ container, pitch: 30, zoom: 12, light: useAppStore.getState().settings.mapLight }).then((m) => {
            if (cancelled) {
                m.remove();
                return;
            }
            map = m;
            mapRef.current = m;
            m.on('dragstart', () => userMoveRef.current?.());
            m.once('load', () => {
                if (!cancelled) setReady(true);
            });
            const observer = new ResizeObserver(() => m.resize());
            observer.observe(container);
            m.once('remove', () => observer.disconnect());
        });
        return () => {
            cancelled = true;
            markersRef.current.forEach((mk) => mk.remove());
            markersRef.current = [];
            riderRef.current?.remove();
            riderRef.current = null;
            map?.remove();
            mapRef.current = null;
        };
    }, []);

    // Light preset follows the user's preference
    useEffect(() => {
        if (ready && mapRef.current) setMapLight(mapRef.current, mapLight);
    }, [ready, mapLight]);

    // Draw the itinerary
    useEffect(() => {
        const map = mapRef.current;
        if (!ready || !map) return;
        let cancelled = false;

        removeLayers(map, LAYERS, SOURCES);
        markersRef.current.forEach((mk) => mk.remove());
        markersRef.current = [];

        const walk = itinerary.legs.filter((l) => l.mode === 'WALK' && l.geometry.length > 1);
        const rides = itinerary.legs.filter((l) => l.mode === 'TRANSIT' && l.geometry.length > 1);

        map.addSource('plan-walk', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: walk.map((l) => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: l.geometry } })) },
        });
        map.addSource('plan-ride', {
            type: 'geojson',
            data: {
                type: 'FeatureCollection',
                features: rides.map((l) => ({ type: 'Feature', properties: { color: visibleOnMap(l.line?.color || '#525252', dark) }, geometry: { type: 'LineString', coordinates: l.geometry } })),
            },
        });
        map.addSource('plan-stops', {
            type: 'geojson',
            data: {
                type: 'FeatureCollection',
                features: rides.flatMap((l) => {
                    const color = l.line?.color || '#525252';
                    return [
                        { type: 'Feature' as const, properties: { color, kind: 'end' }, geometry: { type: 'Point' as const, coordinates: [l.from.lng, l.from.lat] } },
                        ...(l.stops || []).map((s) => ({ type: 'Feature' as const, properties: { color, kind: 'mid' }, geometry: { type: 'Point' as const, coordinates: [s.lng, s.lat] } })),
                        { type: 'Feature' as const, properties: { color, kind: 'end' }, geometry: { type: 'Point' as const, coordinates: [l.to.lng, l.to.lat] } },
                    ];
                }),
            },
        });

        map.addLayer({
            id: 'plan-walk',
            type: 'line',
            source: 'plan-walk',
            slot: 'middle',
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: { 'line-color': dark ? '#e5e5e5' : '#262626', 'line-width': 4.5, 'line-dasharray': [0.1, 1.9], 'line-emissive-strength': 1 },
        });
        map.addLayer({
            id: 'plan-ride-casing',
            type: 'line',
            source: 'plan-ride',
            slot: 'middle',
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: { 'line-color': '#000000', 'line-width': 10, 'line-opacity': 0.85 },
        });
        map.addLayer({
            id: 'plan-ride',
            type: 'line',
            source: 'plan-ride',
            slot: 'middle',
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            // Emissive: route colors stay true under the night light preset
            paint: { 'line-color': ['get', 'color'], 'line-width': 6, 'line-emissive-strength': 1 },
        });
        map.addLayer({
            id: 'plan-stops',
            type: 'circle',
            source: 'plan-stops',
            slot: 'top',
            paint: {
                'circle-radius': ['case', ['==', ['get', 'kind'], 'end'], 6.5, 3],
                'circle-color': ['case', ['==', ['get', 'kind'], 'end'], '#ffffff', ['get', 'color']],
                'circle-stroke-color': ['case', ['==', ['get', 'kind'], 'end'], ['get', 'color'], '#ffffff'],
                'circle-stroke-width': ['case', ['==', ['get', 'kind'], 'end'], 3.5, 1.2],
                'circle-emissive-strength': 1,
            },
        });

        loadMapbox().then((mapboxgl) => {
            if (cancelled || !mapRef.current) return;
            markersRef.current = [
                new mapboxgl.Marker({ element: endpointEl('from') }).setLngLat([from.lng, from.lat]).addTo(map),
                new mapboxgl.Marker({ element: endpointEl('to'), anchor: 'bottom-left' }).setLngLat([to.lng, to.lat]).addTo(map),
            ];
        });

        return () => {
            cancelled = true;
        };
    }, [ready, itinerary, from, to, dark]);

    // Frame the route (or the rider when following)
    useEffect(() => {
        const map = mapRef.current;
        if (!ready || !map) return;
        const [top, bottom, left, right] = padKey.split(',').map(Number);
        if (follow && rider) {
            map.easeTo({ center: [rider.lng, rider.lat], zoom: Math.max(map.getZoom(), 15.5), pitch: 50, duration: 900 });
        } else if (itinerary.bounds) {
            map.fitBounds(itinerary.bounds, { padding: { top, bottom, left, right }, pitch: 30, duration: 700, maxZoom: 16 });
        }
        // rider is intentionally read only when re-centering or toggling follow
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ready, itinerary, recenterKey, follow, padKey]);

    // Rider marker + following
    const riderLat = rider?.lat;
    const riderLng = rider?.lng;
    const riderHeading = rider?.heading ?? null;
    useEffect(() => {
        const map = mapRef.current;
        if (!ready || !map || riderLat === undefined || riderLng === undefined) {
            riderRef.current?.remove();
            riderRef.current = null;
            return;
        }
        let cancelled = false;
        loadMapbox().then((mapboxgl) => {
            if (cancelled || !mapRef.current) return;
            if (!riderRef.current) {
                riderRef.current = new mapboxgl.Marker({ element: riderEl() }).setLngLat([riderLng, riderLat]).addTo(map);
            } else {
                riderRef.current.setLngLat([riderLng, riderLat]);
            }
            const cone = riderRef.current.getElement().querySelector<HTMLElement>('[data-cone]');
            if (cone) {
                cone.style.opacity = riderHeading === null ? '0' : '1';
                cone.style.transform = `rotate(${riderHeading ?? 0}deg)`;
            }
            if (follow) map.easeTo({ center: [riderLng, riderLat], duration: 900 });
        });
        return () => {
            cancelled = true;
        };
    }, [ready, riderLat, riderLng, riderHeading, follow]);

    return <div ref={containerRef} className={cn('relative w-full h-full bg-secondary', className)} aria-label="Mapa del recorrido" role="img" />;
}

/**
 * The itinerary map. Under data saver it starts as a sketch drawn from the
 * itinerary itself, which downloads nothing, and loads the real map on request.
 */
export default function ItineraryMap(props: ItineraryMapProps) {
    const hydrated = useHydrated();
    const saving = useDataSaver();
    const [wantMap, setWantMap] = useState(false);
    // Wait for saved settings, so a map isn't started only to be swapped for the sketch
    if (!hydrated) return <div className={cn('relative w-full h-full bg-secondary', props.className)} />;
    if (saving && !wantMap) return <RouteSketch {...props} onShowMap={() => setWantMap(true)} />;
    return <LiveMap {...props} />;
}
