'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Itinerary } from '@/types/transit';
import { haversine } from '@/lib/geo';

interface TimedPoint {
    t: number; // seconds from trip start
    lat: number;
    lng: number;
}

interface DemoState {
    latitude: number | null;
    longitude: number | null;
    heading: number | null;
    done: boolean;
}

function bearing(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
    const toRad = (d: number) => (d * Math.PI) / 180;
    const y = Math.sin(toRad(b.lng - a.lng)) * Math.cos(toRad(b.lat));
    const x = Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) - Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lng - a.lng));
    return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** Every vertex of every leg, stamped with the time the plan says you'd be there. */
function timeline(itinerary: Itinerary): TimedPoint[] {
    const points: TimedPoint[] = [];
    let start = 0;
    for (const leg of itinerary.legs) {
        const coords = leg.geometry.length > 1 ? leg.geometry : [[leg.from.lng, leg.from.lat], [leg.to.lng, leg.to.lat]] as [number, number][];
        const dists = [0];
        for (let i = 1; i < coords.length; i++) {
            dists.push(dists[i - 1] + haversine({ lat: coords[i - 1][1], lng: coords[i - 1][0] }, { lat: coords[i][1], lng: coords[i][0] }));
        }
        const total = dists[dists.length - 1] || 1;
        const seconds = Math.max(30, leg.durationMin * 60);
        coords.forEach(([lng, lat], i) => points.push({ t: start + (dists[i] / total) * seconds, lat, lng }));
        start += seconds;
    }
    return points;
}

/**
 * Simulated rider that follows the itinerary at `speed`× real time. Same shape
 * as useGeolocation so the trip screen can't tell the difference.
 */
export function useDemoPosition(itinerary: Itinerary | null, speed = 20) {
    const points = useMemo(() => (itinerary ? timeline(itinerary) : []), [itinerary]);
    const [state, setState] = useState<DemoState>({ latitude: null, longitude: null, heading: null, done: false });

    useEffect(() => {
        if (points.length < 2) return;
        const startedAt = Date.now();
        const end = points[points.length - 1].t;
        let i = 0;

        const tick = () => {
            const t = Math.min(end, ((Date.now() - startedAt) / 1000) * speed);
            while (i < points.length - 2 && points[i + 1].t <= t) i++;
            const a = points[i], b = points[i + 1];
            const f = b.t > a.t ? Math.min(1, (t - a.t) / (b.t - a.t)) : 1;
            setState({
                latitude: a.lat + (b.lat - a.lat) * f,
                longitude: a.lng + (b.lng - a.lng) * f,
                heading: bearing(a, b),
                done: t >= end,
            });
            if (t >= end) clearInterval(id);
        };

        const id = setInterval(tick, 1000);
        const first = setTimeout(tick, 50);
        return () => {
            clearInterval(id);
            clearTimeout(first);
        };
    }, [points, speed]);

    return {
        latitude: state.latitude,
        longitude: state.longitude,
        heading: state.heading,
        accuracy: state.latitude !== null ? 5 : null,
        speed: null as number | null,
        error: null as string | null,
        loading: state.latitude === null && points.length > 1,
        done: state.done,
        requestLocation: () => { /* simulated */ },
    };
}
