'use client';

import { useEffect, useState } from 'react';

/** Keeps the screen on while `enabled`; re-acquires when the tab becomes visible again. */
export function useWakeLock(enabled: boolean): boolean {
    const [active, setActive] = useState(false);

    useEffect(() => {
        if (!enabled || typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
        let sentinel: WakeLockSentinel | null = null;
        let disposed = false;

        const acquire = async () => {
            try {
                const s = await navigator.wakeLock.request('screen');
                if (disposed) {
                    s.release().catch(() => { /* already released */ });
                    return;
                }
                sentinel = s;
                setActive(true);
                s.addEventListener('release', () => {
                    if (!disposed) setActive(false);
                });
            } catch {
                if (!disposed) setActive(false);
            }
        };

        acquire();
        const onVisibility = () => {
            if (document.visibilityState === 'visible' && (!sentinel || sentinel.released)) acquire();
        };
        document.addEventListener('visibilitychange', onVisibility);

        return () => {
            disposed = true;
            document.removeEventListener('visibilitychange', onVisibility);
            sentinel?.release().catch(() => { /* already released */ });
        };
    }, [enabled]);

    return enabled && active;
}
