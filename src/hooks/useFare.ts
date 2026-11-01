'use client';

import { useEffect, useState } from 'react';

const FALLBACK_FARE = 3550;
let known: number | null = null;
let request: Promise<number> | null = null;

/** Current TransMilenio fare: fetched once per session and shared by every card that needs it. */
export function useFare(): number {
    const [fare, setFare] = useState(known ?? FALLBACK_FARE);
    useEffect(() => {
        if (known) return;
        request ??= fetch('/api/info')
            .then((r) => r.json())
            .then((json: { fare?: number }) => (known = json.fare || FALLBACK_FARE))
            .catch(() => {
                request = null;
                return FALLBACK_FARE;
            });
        let alive = true;
        request.then((value) => { if (alive) setFare(value); });
        return () => { alive = false; };
    }, []);
    return fare;
}
