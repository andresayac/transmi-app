'use client';

import { useSyncExternalStore } from 'react';
import { useAppStore } from '@/stores/app';

/**
 * Data saver: for prepaid plans and slow phones. Maps go flat and load on
 * request, live data refreshes half as often and speech uses the phone's own
 * voice. "auto" follows the phone (Android's data saver / Lite mode, or 2G).
 */

type NetworkInfo = EventTarget & { saveData?: boolean; effectiveType?: string };

function network(): NetworkInfo | null {
    if (typeof navigator === 'undefined') return null;
    return (navigator as Navigator & { connection?: NetworkInfo }).connection ?? null;
}

/** The phone itself asks apps to save data, or the connection is 2G-class. */
export function phoneAsksToSaveData(): boolean {
    const n = network();
    return !!n && (n.saveData === true || n.effectiveType === 'slow-2g' || n.effectiveType === '2g');
}

export function isDataSaver(): boolean {
    const pref = useAppStore.getState().settings.dataSaver;
    return pref === 'on' || (pref === 'auto' && phoneAsksToSaveData());
}

function subscribe(onChange: () => void) {
    const unsubscribe = useAppStore.subscribe((s, prev) => {
        if (s.settings.dataSaver !== prev.settings.dataSaver) onChange();
    });
    const n = network();
    n?.addEventListener('change', onChange);
    return () => {
        unsubscribe();
        n?.removeEventListener('change', onChange);
    };
}

export function useDataSaver(): boolean {
    return useSyncExternalStore(subscribe, isDataSaver, () => false);
}

/** Polling period under data saver: half as often, and never faster than every 20 s. */
export function saverInterval(ms: number, saving: boolean): number {
    return saving && ms > 0 ? Math.max(ms * 2, 20000) : ms;
}
