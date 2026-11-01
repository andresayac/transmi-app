'use client';

import { useEffect } from 'react';

export default function ServiceWorkerRegistration() {
    useEffect(() => {
        if (!('serviceWorker' in navigator)) return;
        // In development the SW would serve stale bundles; only register in production builds
        if (process.env.NODE_ENV !== 'production') {
            navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister())).catch(() => undefined);
            return;
        }
        navigator.serviceWorker.register('/sw.js').catch(() => {
            // Registration failed — the app works without it
        });
    }, []);

    return null;
}
