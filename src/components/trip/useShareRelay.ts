'use client';

import { useEffect, useRef } from 'react';
import type { ShareUpdate } from '@/lib/tripShare';

const HEARTBEAT_MS = 60000;

/** One progress report for a shared trip. Failures are fine: the next report repeats the state. */
export function reportShare(id: string, update: ShareUpdate, keepalive = false) {
    return fetch(`/api/sigue/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(update),
        keepalive,
    }).catch(() => undefined);
}

interface Progress {
    leg: number;
    bus: string | null;
    /** Expected arrival, epoch ms */
    eta: number | null;
    ended: boolean;
}

/**
 * While the trip is shared, keep the follower's page in step: report right away
 * when the leg or the bus changes (a transfer, the bus detected) or the trip
 * ends, and every minute in between (fresh ETA, and proof the phone is still on it).
 */
export function useShareRelay(share: { id: string; key: string } | undefined, progress: Progress) {
    const latest = useRef(progress);
    useEffect(() => {
        latest.current = progress;
    });

    const id = share?.id;
    const key = share?.key;
    const { leg, bus, ended } = progress;
    useEffect(() => {
        if (!id || !key) return;
        const send = () => {
            const p = latest.current;
            reportShare(id, { key, leg: p.leg, bus: p.bus, eta: p.eta, ended: p.ended }, p.ended);
        };
        send();
        if (ended) return;
        const timer = setInterval(send, HEARTBEAT_MS);
        return () => clearInterval(timer);
    }, [id, key, leg, bus, ended]);
}
