'use client';

import { useEffect, useMemo, useState } from 'react';
import type { LiveBus } from '@/types/transit';

export interface LiveBusRequest {
    key: string;
    codigo: string;
    nombre: string;
}

/**
 * Polls /api/live for every requested route (default every 8s) and returns the
 * buses keyed by route. Pauses while the tab is hidden; refreshes on return.
 */
export function useLiveBuses(requests: LiveBusRequest[], intervalMs = 8000) {
    const [byRoute, setByRoute] = useState<Record<string, LiveBus[]>>({});
    const [updatedAt, setUpdatedAt] = useState<number | null>(null);

    // A stable signature so the effect only restarts when the set of routes changes
    const signature = useMemo(() => requests.map((r) => `${r.key}|${r.codigo}|${r.nombre}`).sort().join('§'), [requests]);

    useEffect(() => {
        const list = signature ? signature.split('§').map((s) => {
            const [key, codigo, nombre] = s.split('|');
            return { key, codigo, nombre };
        }) : [];
        let cancelled = false;
        let timer: ReturnType<typeof setInterval> | null = null;
        let controller: AbortController | null = null;

        const load = async () => {
            controller?.abort();
            const ctrl = new AbortController();
            controller = ctrl;
            const results = await Promise.allSettled(list.map(async (r) => {
                const res = await fetch(`/api/live?ruta=${encodeURIComponent(r.codigo)}&nombre=${encodeURIComponent(r.nombre)}`, { signal: ctrl.signal });
                if (!res.ok) throw new Error(String(res.status));
                const json = (await res.json()) as { buses?: LiveBus[] };
                return [r.key, json.buses || []] as const;
            }));
            if (cancelled || ctrl.signal.aborted) return;
            setByRoute((prev) => {
                const next: Record<string, LiveBus[]> = {};
                results.forEach((res, i) => {
                    const key = list[i].key;
                    // Keep the last known positions when one poll fails
                    next[key] = res.status === 'fulfilled' ? [...res.value[1]] : prev[key] || [];
                });
                return next;
            });
            setUpdatedAt(Date.now());
        };

        const startTimer = () => {
            if (!timer && list.length) timer = setInterval(load, intervalMs);
        };
        const stopTimer = () => {
            if (timer) clearInterval(timer);
            timer = null;
        };
        const onVisibility = () => {
            if (document.hidden) stopTimer();
            else {
                load();
                startTimer();
            }
        };

        if (list.length) {
            load();
            startTimer();
        } else {
            Promise.resolve().then(() => { if (!cancelled) setByRoute({}); });
        }
        document.addEventListener('visibilitychange', onVisibility);

        return () => {
            cancelled = true;
            stopTimer();
            controller?.abort();
            document.removeEventListener('visibilitychange', onVisibility);
        };
    }, [signature, intervalMs]);

    return { byRoute, updatedAt };
}
