'use client';

import { useEffect, useState } from 'react';
import { useGeolocation } from './useGeolocation';

/**
 * Location for passive features (home cards): reads the position on its own only
 * when permission was already granted, so the home screen never opens with a
 * permission prompt. Call requestLocation() from a button to ask explicitly.
 */
export function useKnownLocation() {
    const geo = useGeolocation({ auto: false });
    const [permission, setPermission] = useState<PermissionState | 'unknown'>('unknown');
    const { requestLocation } = geo;

    useEffect(() => {
        let cancelled = false;
        navigator.permissions?.query({ name: 'geolocation' as PermissionName })
            .then((status) => {
                if (cancelled) return;
                setPermission(status.state);
                if (status.state === 'granted') requestLocation();
                status.onchange = () => setPermission(status.state);
            })
            .catch(() => setPermission('prompt'));
        return () => { cancelled = true; };
    }, [requestLocation]);

    return { ...geo, permission };
}
