'use client';

import { useState, useEffect, useCallback } from 'react';

interface GeoState {
    latitude: number | null;
    longitude: number | null;
    error: string | null;
    loading: boolean;
}

export function useGeolocation() {
    const [state, setState] = useState<GeoState>({
        latitude: null,
        longitude: null,
        error: null,
        loading: false,
    });

    const requestLocation = useCallback(() => {
        if (!navigator.geolocation) {
            setState((prev) => ({ ...prev, error: 'Geolocalización no soportada' }));
            return;
        }

        setState((prev) => ({ ...prev, loading: true }));

        navigator.geolocation.getCurrentPosition(
            (position) => {
                setState({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    error: null,
                    loading: false,
                });
            },
            (err) => {
                setState((prev) => ({
                    ...prev,
                    error: err.message,
                    loading: false,
                }));
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
        );
    }, []);

    useEffect(() => {
        requestLocation();
    }, [requestLocation]);

    return { ...state, requestLocation };
}
