'use client';

import { useEffect, useRef, useState } from 'react';
import { haversine } from '@/lib/geo';
import type { LiveBus } from '@/types/transit';
import { saverInterval, useDataSaver } from '@/lib/dataSaver';

const POLL_MS = 10000;
/** A bus counts as "yours" when it's this close on two readings in a row */
const MATCH_M = 150;
/** …and stops being yours after three readings this far away */
const LOST_M = 450;

export interface MyBus {
    label: string;
    distanceM: number;
}

/**
 * Which bus is the rider on? Compares the phone's position with the live
 * positions of the leg's route. Bus GPS lags a few seconds, so the match needs
 * two consecutive close readings, and is dropped only after three far ones.
 */
export function useMyBus(routeCode: string | null, position: { lat: number; lng: number } | null): MyBus | null {
    const [bus, setBus] = useState<MyBus | null>(null);
    const every = saverInterval(POLL_MS, useDataSaver());
    const posRef = useRef(position);
    const state = useRef({ candidate: '', hits: 0, misses: 0, confirmed: '' });

    useEffect(() => {
        posRef.current = position;
    }, [position]);

    useEffect(() => {
        // New leg (or none): forget the previous bus
        state.current = { candidate: '', hits: 0, misses: 0, confirmed: '' };
        const reset = setTimeout(() => setBus(null), 0);
        if (!routeCode) return () => clearTimeout(reset);

        let cancelled = false;
        const check = async () => {
            const here = posRef.current;
            if (!here || document.hidden) return;
            try {
                const res = await fetch(`/api/live?ruta=${encodeURIComponent(routeCode)}`);
                if (!res.ok || cancelled) return;
                const { buses } = (await res.json()) as { buses: LiveBus[] };
                const s = state.current;
                const ranked = buses
                    .map((b) => ({ label: b.label, d: haversine(here, b) }))
                    .sort((a, b) => a.d - b.d);
                const nearest = ranked[0];

                if (s.confirmed) {
                    const mine = ranked.find((b) => b.label === s.confirmed);
                    if (mine && mine.d < LOST_M) {
                        s.misses = 0;
                        setBus({ label: s.confirmed, distanceM: mine.d });
                    } else if (++s.misses >= 3) {
                        s.confirmed = '';
                        s.candidate = '';
                        s.hits = 0;
                        setBus(null);
                    }
                    return;
                }

                if (nearest && nearest.d < MATCH_M) {
                    s.hits = s.candidate === nearest.label ? s.hits + 1 : 1;
                    s.candidate = nearest.label;
                    if (s.hits >= 2) {
                        s.confirmed = nearest.label;
                        s.misses = 0;
                        setBus({ label: nearest.label, distanceM: nearest.d });
                    }
                } else {
                    s.candidate = '';
                    s.hits = 0;
                }
            } catch { /* network hiccup: try again on the next tick */ }
        };

        check();
        const timer = setInterval(check, every);
        return () => {
            cancelled = true;
            clearTimeout(reset);
            clearInterval(timer);
        };
    }, [routeCode, every]);

    return bus;
}
