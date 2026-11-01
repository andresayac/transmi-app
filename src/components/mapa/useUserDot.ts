'use client';

import { useEffect, useRef } from 'react';
import type { Map as MapboxMap, Marker } from 'mapbox-gl';
import { loadMapbox } from '@/lib/mapbox';
import { userDotElement } from './mapDom';

/** Draws the rider's position as a pulsing blue dot (the one non-transit color on the map, by convention). */
export function useUserDot(map: MapboxMap | null, lat: number | null, lng: number | null) {
    const marker = useRef<Marker | null>(null);

    useEffect(() => {
        if (!map || lat === null || lng === null) return;
        let cancelled = false;
        loadMapbox().then((mapboxgl) => {
            if (cancelled) return;
            if (!marker.current) {
                marker.current = new mapboxgl.Marker({ element: userDotElement(), anchor: 'center' }).setLngLat([lng, lat]).addTo(map);
            } else {
                marker.current.setLngLat([lng, lat]);
            }
        });
        return () => {
            cancelled = true;
        };
    }, [map, lat, lng]);

    useEffect(() => {
        return () => {
            marker.current?.remove();
            marker.current = null;
        };
    }, [map]);
}
