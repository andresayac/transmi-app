'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface LiveState<T> {
    data: T | null;
    error: string | null;
    loading: boolean;
    updatedAt: number | null;
}

/**
 * Fetch JSON from `url` and optionally re-poll every `intervalMs`.
 * Polling pauses while the tab is hidden and resumes (with an immediate refresh) when visible.
 * Pass `null` as url to stay idle.
 */
export function useLiveData<T>(url: string | null, intervalMs = 0) {
    const [state, setState] = useState<LiveState<T>>({ data: null, error: null, loading: !!url, updatedAt: null });
    const controller = useRef<AbortController | null>(null);
    const urlRef = useRef(url);

    const load = useCallback(async () => {
        const target = urlRef.current;
        if (!target) return;
        controller.current?.abort();
        const ctrl = new AbortController();
        controller.current = ctrl;
        setState((s) => ({ ...s, loading: true }));
        try {
            const res = await fetch(target, { signal: ctrl.signal });
            const json = await res.json();
            if (!res.ok) throw new Error(json?.error || 'Error de conexión');
            if (urlRef.current === target) setState({ data: json as T, error: null, loading: false, updatedAt: Date.now() });
        } catch (err) {
            if ((err as Error).name === 'AbortError') return;
            setState((s) => ({ ...s, error: (err as Error).message || 'Error de conexión', loading: false }));
        }
    }, []);

    useEffect(() => {
        urlRef.current = url;
        if (!url) {
            setState({ data: null, error: null, loading: false, updatedAt: null });
            return;
        }
        setState((s) => ({ ...s, data: null, error: null }));
        load();
        if (!intervalMs) return () => controller.current?.abort();

        let timer: ReturnType<typeof setInterval> | null = setInterval(load, intervalMs);
        const onVisibility = () => {
            if (document.hidden) {
                if (timer) clearInterval(timer);
                timer = null;
            } else if (!timer) {
                load();
                timer = setInterval(load, intervalMs);
            }
        };
        document.addEventListener('visibilitychange', onVisibility);
        return () => {
            if (timer) clearInterval(timer);
            document.removeEventListener('visibilitychange', onVisibility);
            controller.current?.abort();
        };
    }, [url, intervalMs, load]);

    return { ...state, refresh: load };
}
