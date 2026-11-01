'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useAppStore, type ActiveTrip } from '@/stores/app';
import { buildAlertTrip, type AlertUpdate } from '@/lib/tripAlerts';
import { pushSubscription, pushSupport } from '@/lib/pwa';

const HEARTBEAT_MS = 30000;

const noopSubscribe = () => () => undefined;

export type LockAlertsStatus =
    | 'unsupported'
    /** iPhone: only once TransMi is on the home screen */
    | 'install'
    | 'denied'
    | 'off'
    | 'starting'
    | 'on'
    | 'failed';

interface Progress {
    leg: number;
    /** Bus recognized for the current leg */
    bus: string | null;
    alarmStops: number;
}

/** null when the network failed; "unknown" when the server no longer has the trip. */
function sendUpdate(id: string, update: AlertUpdate): Promise<{ fired?: string[] } | 'unknown' | null> {
    return fetch(`/api/avisos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(update),
        keepalive: true,
    })
        .then((r) => (r.status === 404 ? 'unknown' as const : r.ok ? r.json() : null))
        .catch(() => null);
}

/**
 * "Avisos con TransMi cerrada": registers the trip with the server, which then
 * follows the rider's bus and sends a push before the stop (see lib/tripAlerts.ts).
 * While TransMi is on screen the phone alerts by itself; both sides share the
 * list of alerts already given, so none plays twice.
 */
export function useLockAlerts(trip: ActiveTrip, active: boolean, progress: Progress) {
    const enabled = useAppStore((s) => s.settings.lockAlerts);
    const updateSettings = useAppStore((s) => s.updateSettings);
    const setTripAlerts = useAppStore((s) => s.setTripAlerts);
    const support = useSyncExternalStore(noopSubscribe, pushSupport, () => 'unsupported' as const);
    const [permission, setPermission] = useState<NotificationPermission | null>(() => (typeof Notification === 'undefined' ? null : Notification.permission));
    const [failed, setFailed] = useState(false);

    const latest = useRef(progress);
    useEffect(() => {
        latest.current = progress;
    });
    const fired = useRef(new Set<string>());
    const reportRef = useRef<(() => void) | null>(null);
    // The finished trip keeps its handle after the store's active trip is cleared
    const handle = useRef(trip.alerts);
    useEffect(() => {
        handle.current = trip.alerts;
    });

    const watchId = trip.alerts?.id;
    const watchKey = trip.alerts?.key;
    const hasRides = trip.itinerary.legs.some((l) => l.mode === 'TRANSIT');

    // Register the trip once (needs permission; the subscription is reused across trips)
    useEffect(() => {
        if (!active || !enabled || !hasRides || watchId || support !== 'ok' || permission !== 'granted' || failed) return;
        let cancelled = false;
        (async () => {
            const subscription = await pushSubscription();
            const { leg, bus, alarmStops } = latest.current;
            const res = await fetch('/api/avisos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subscription, trip: buildAlertTrip(trip), leg, bus, alarmStops }),
            });
            if (!res.ok) throw new Error(`avisos ${res.status}`);
            const created = (await res.json()) as { id: string; key: string };
            if (!cancelled) setTripAlerts(created);
        })().catch(() => {
            if (!cancelled) setFailed(true);
        });
        return () => { cancelled = true; };
    }, [active, enabled, hasRides, watchId, support, permission, failed, trip, setTripAlerts]);

    // Keep the server in step: on every change, when TransMi goes to the background, and every 30 s
    const { leg, bus, alarmStops } = progress;
    useEffect(() => {
        if (!watchId || !watchKey || !active) return;
        const report = () => {
            const p = latest.current;
            const visible = document.visibilityState === 'visible';
            void sendUpdate(watchId, { key: watchKey, leg: p.leg, bus: p.bus, visible, fired: [...fired.current], alarmStops: p.alarmStops })
                .then((answer) => {
                    // Expired or lost on the server: register the trip again
                    if (answer === 'unknown') setTripAlerts(undefined);
                    else answer?.fired?.forEach((k) => fired.current.add(k));
                });
        };
        reportRef.current = report;
        report();
        const timer = setInterval(report, HEARTBEAT_MS);
        document.addEventListener('visibilitychange', report);
        window.addEventListener('pagehide', report);
        return () => {
            reportRef.current = null;
            clearInterval(timer);
            document.removeEventListener('visibilitychange', report);
            window.removeEventListener('pagehide', report);
        };
    }, [watchId, watchKey, active, leg, bus, alarmStops, setTripAlerts]);

    /** Stop the server's alerts: the trip ended or the rider arrived. */
    const stop = useCallback(() => {
        const alerts = handle.current;
        if (!alerts) return;
        const p = latest.current;
        void sendUpdate(alerts.id, { key: alerts.key, leg: p.leg, bus: null, visible: true, fired: [], alarmStops: p.alarmStops, ended: true });
    }, []);

    // Turned off in the middle of a trip: stop the server's alerts too
    useEffect(() => {
        if (enabled || !watchId) return;
        stop();
        setTripAlerts(undefined);
    }, [enabled, watchId, stop, setTripAlerts]);

    /** Was this alert already given here or by the server? */
    const given = useCallback((key: string) => fired.current.has(key), []);
    /** Note an alert the phone just gave, and tell the server right away. */
    const give = useCallback((key: string) => {
        fired.current.add(key);
        reportRef.current?.();
    }, []);

    /** From a tap: ask for notifications, subscribe, and turn the setting on. */
    const enable = async () => {
        if (support !== 'ok') return;
        const result = Notification.permission === 'default' ? await Notification.requestPermission().catch(() => 'denied' as const) : Notification.permission;
        setPermission(result);
        if (result !== 'granted') return;
        // Subscribing inside the tap keeps iPhone happy; registering the trip happens above
        await pushSubscription().catch(() => undefined);
        setFailed(false);
        updateSettings({ lockAlerts: true });
    };

    const retry = () => setFailed(false);

    let status: LockAlertsStatus;
    if (support !== 'ok') status = support;
    else if (permission === 'denied') status = 'denied';
    else if (!enabled || permission !== 'granted') status = 'off';
    else if (watchId) status = 'on';
    else status = failed ? 'failed' : 'starting';

    return { status, enable, retry, stop, given, give, hasRides };
}
