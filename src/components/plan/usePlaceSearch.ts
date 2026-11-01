'use client';

import { useEffect, useState } from 'react';
import type { PlanPlace } from '@/types/transit';

interface SearchResult {
    query: string;
    places: PlanPlace[];
    error: string | null;
}

/** Debounced (250 ms) place + station search biased to the rider's position. */
export function usePlaceSearch(query: string, near?: { lat: number; lng: number } | null) {
    const [result, setResult] = useState<SearchResult>({ query: '', places: [], error: null });
    const q = query.trim();
    const nearKey = near ? `${near.lat.toFixed(3)},${near.lng.toFixed(3)}` : '';

    useEffect(() => {
        if (q.length < 2) return;
        const ctrl = new AbortController();
        const timer = setTimeout(async () => {
            const params = new URLSearchParams({ q });
            if (nearKey) {
                const [lat, lng] = nearKey.split(',');
                params.set('lat', lat);
                params.set('lng', lng);
            }
            try {
                const res = await fetch(`/api/geocode?${params.toString()}`, { signal: ctrl.signal });
                const json = await res.json();
                if (!res.ok) throw new Error(json?.error || 'Sin conexión');
                setResult({ query: q, places: json.places || [], error: null });
            } catch (err) {
                if ((err as Error).name === 'AbortError') return;
                setResult({ query: q, places: [], error: 'No pudimos buscar lugares. Revisa tu conexión.' });
            }
        }, 250);
        return () => {
            clearTimeout(timer);
            ctrl.abort();
        };
    }, [q, nearKey]);

    const active = q.length >= 2;
    const fresh = active && result.query === q;
    return {
        places: fresh ? result.places : [],
        error: fresh ? result.error : null,
        loading: active && !fresh,
    };
}
