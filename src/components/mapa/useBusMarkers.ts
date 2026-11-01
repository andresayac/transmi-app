'use client';

import { useCallback, useEffect, useRef } from 'react';
import type { Map as MapboxMap, Marker, Popup } from 'mapbox-gl';
import type { LiveBus } from '@/types/transit';
import { loadMapbox } from '@/lib/mapbox';
import { busPopupContent, createBusElement, paintBusElement } from './mapDom';

export interface BusGroup {
    key: string;
    color: string;
    routeCode: string;
    buses: LiveBus[];
}

interface Entry {
    marker: Marker;
    popup: Popup;
    parts: ReturnType<typeof createBusElement>;
    from: [number, number];
    to: [number, number];
    start: number;
}

const DURATION = 1500;
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/** One animation loop for all markers; stops itself when every bus has arrived. */
function animate(entries: Map<string, Entry>, raf: { current: number }) {
    const step = () => {
        const now = performance.now();
        let active = false;
        entries.forEach((e) => {
            const t = Math.min(1, (now - e.start) / DURATION);
            const k = easeOut(t);
            e.marker.setLngLat([e.from[0] + (e.to[0] - e.from[0]) * k, e.from[1] + (e.to[1] - e.from[1]) * k]);
            if (t < 1) active = true;
        });
        raf.current = active ? requestAnimationFrame(step) : 0;
    };
    if (!raf.current) raf.current = requestAnimationFrame(step);
}

/**
 * Keeps one DOM marker per live bus and glides it to each new position
 * (ease-out over ~1.5s) instead of jumping every poll.
 */
export function useBusMarkers(map: MapboxMap | null, groups: BusGroup[]) {
    const entries = useRef(new Map<string, Entry>());
    const raf = useRef(0);

    useEffect(() => {
        if (!map) return;
        let cancelled = false;
        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        loadMapbox().then((mapboxgl) => {
            if (cancelled) return;
            const seen = new Set<string>();
            const now = performance.now();

            for (const group of groups) {
                for (const bus of group.buses) {
                    const id = `${group.key}:${bus.id}`;
                    seen.add(id);
                    const target: [number, number] = [bus.lng, bus.lat];
                    const existing = entries.current.get(id);
                    if (existing) {
                        const cur = existing.marker.getLngLat();
                        existing.from = [cur.lng, cur.lat];
                        existing.to = target;
                        existing.start = reduceMotion ? now - DURATION : now;
                        paintBusElement(existing.parts, bus, group.color, group.routeCode);
                        existing.popup.setDOMContent(busPopupContent(bus, group.color, group.routeCode));
                        continue;
                    }
                    const parts = createBusElement(group.color);
                    paintBusElement(parts, bus, group.color, group.routeCode);
                    const popup = new mapboxgl.Popup({ offset: 18, maxWidth: '260px', closeButton: false }).setDOMContent(
                        busPopupContent(bus, group.color, group.routeCode),
                    );
                    const marker = new mapboxgl.Marker({ element: parts.root, anchor: 'center' }).setLngLat(target).setPopup(popup).addTo(map);
                    parts.root.addEventListener('keydown', (ev) => {
                        if (ev.key === 'Enter' || ev.key === ' ') marker.togglePopup();
                    });
                    entries.current.set(id, { marker, popup, parts, from: target, to: target, start: now - DURATION });
                }
            }

            entries.current.forEach((e, id) => {
                if (!seen.has(id)) {
                    e.marker.remove();
                    entries.current.delete(id);
                }
            });

            animate(entries.current, raf);
        });

        return () => {
            cancelled = true;
        };
    }, [map, groups]);

    // Remove everything when the map goes away or the hook unmounts
    useEffect(() => {
        const current = entries.current;
        return () => {
            cancelAnimationFrame(raf.current);
            raf.current = 0;
            current.forEach((e) => e.marker.remove());
            current.clear();
        };
    }, [map]);

    /** Fly to a bus and open its popup. */
    const focusBus = useCallback((groupKey: string, busId: string) => {
        const e = entries.current.get(`${groupKey}:${busId}`);
        if (!e || !map) return;
        map.flyTo({ center: e.to, zoom: Math.max(map.getZoom(), 15), duration: 900 });
        if (!e.popup.isOpen()) e.marker.togglePopup();
    }, [map]);

    return { focusBus };
}
