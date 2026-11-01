'use client';

import { useSyncExternalStore } from 'react';

let current = Date.now();

function subscribe(onChange: () => void) {
    const tick = () => {
        current = Date.now();
        onChange();
    };
    tick();
    const id = setInterval(tick, 20000);
    return () => clearInterval(id);
}

/** Epoch ms that refreshes every 20 s — for "leave at / arrive at" clock times. */
export function useClock(): number {
    return useSyncExternalStore(subscribe, () => current, () => 0);
}
