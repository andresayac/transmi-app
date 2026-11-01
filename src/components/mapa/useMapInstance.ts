'use client';

import { useEffect, useRef, useState } from 'react';
import type { Map as MapboxMap } from 'mapbox-gl';
import { createMap, MapLightPref } from '@/lib/mapbox';

interface MapInit {
    center?: [number, number];
    zoom?: number;
    light: MapLightPref;
}

/**
 * Creates the Mapbox map once. During client-side navigation the container can
 * have zero size for a few frames, so we wait (up to ~20 frames) before creating
 * it, and keep it sized with a ResizeObserver.
 */
export function useMapInstance(init: MapInit) {
    const containerRef = useRef<HTMLDivElement>(null);
    const initRef = useRef(init);
    const [map, setMap] = useState<MapboxMap | null>(null);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        let cancelled = false;
        let instance: MapboxMap | null = null;
        let observer: ResizeObserver | null = null;
        let raf = 0;
        let attempts = 0;

        const start = async () => {
            const { center, zoom, light } = initRef.current;
            const m = await createMap({ container, center, zoom, light, pitch: 45, bearing: -12 });
            if (cancelled) {
                m.remove();
                return;
            }
            instance = m;
            observer = new ResizeObserver(() => m.resize());
            observer.observe(container);
            m.once('load', () => {
                if (cancelled) return;
                m.resize();
                setReady(true);
            });
            setMap(m);
        };

        const tryStart = () => {
            if ((container.offsetWidth > 0 && container.offsetHeight > 0) || ++attempts >= 20) {
                start();
                return;
            }
            raf = requestAnimationFrame(tryStart);
        };
        raf = requestAnimationFrame(tryStart);

        return () => {
            cancelled = true;
            cancelAnimationFrame(raf);
            observer?.disconnect();
            try { instance?.remove(); } catch { /* already gone */ }
        };
    }, []);

    return { containerRef, map, ready };
}
