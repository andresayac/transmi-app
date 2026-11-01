'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface GeoState {
    latitude: number | null;
    longitude: number | null;
    accuracy: number | null;
    heading: number | null;
    speed: number | null;
    error: string | null;
    loading: boolean;
}

const INITIAL: GeoState = { latitude: null, longitude: null, accuracy: null, heading: null, speed: null, error: null, loading: false };

/**
 * Device location. `watch: true` keeps tracking (trip mode); otherwise a single fix.
 * `auto: false` waits for requestLocation() instead of asking on mount.
 */
export function useGeolocation(options: { watch?: boolean; auto?: boolean } = {}) {
    const { watch = false, auto = true } = options;
    const [state, setState] = useState<GeoState>(INITIAL);
    const watchId = useRef<number | null>(null);

    const onPosition = useCallback((position: GeolocationPosition) => {
        setState({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            heading: position.coords.heading,
            speed: position.coords.speed,
            error: null,
            loading: false,
        });
    }, []);

    const onError = useCallback((err: GeolocationPositionError) => {
        const message = err.code === err.PERMISSION_DENIED
            ? 'Activa el permiso de ubicación para usar esta función'
            : 'No pudimos obtener tu ubicación';
        setState((prev) => ({ ...prev, error: message, loading: false }));
    }, []);

    const requestLocation = useCallback(() => {
        if (typeof navigator === 'undefined' || !navigator.geolocation) {
            setState((prev) => ({ ...prev, error: 'Tu navegador no permite ubicación' }));
            return;
        }
        setState((prev) => ({ ...prev, loading: true }));
        const opts: PositionOptions = { enableHighAccuracy: true, timeout: 12000, maximumAge: watch ? 2000 : 60000 };
        if (watch) {
            if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
            watchId.current = navigator.geolocation.watchPosition(onPosition, onError, opts);
        } else {
            navigator.geolocation.getCurrentPosition(onPosition, onError, opts);
        }
    }, [watch, onPosition, onError]);

    useEffect(() => {
        if (auto) requestLocation();
        return () => {
            if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
            watchId.current = null;
        };
    }, [auto, requestLocation]);

    return { ...state, requestLocation };
}
