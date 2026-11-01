'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { LocateFixed, Map, Navigation } from 'lucide-react';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useLiveData } from '@/hooks/useLiveData';
import ArrivalBoard from '@/components/transit/ArrivalBoard';
import { formatDistance, walkMinutes } from '@/lib/geo';
import type { StationMapEntry } from '@/types/station';

type Nearby = StationMapEntry & { distanceM: number };

/**
 * The closest TransMilenio station with its live departures board.
 * Only asks for location on its own if the permission was already granted.
 */
export default function NearbyStation() {
    const [permission, setPermission] = useState<PermissionState | 'unknown'>('unknown');
    const geo = useGeolocation({ auto: false });
    const { latitude, longitude, requestLocation, loading: locating, error: geoError } = geo;

    useEffect(() => {
        let cancelled = false;
        navigator.permissions?.query({ name: 'geolocation' as PermissionName }).then((status) => {
            if (cancelled) return;
            setPermission(status.state);
            if (status.state === 'granted') requestLocation();
            status.onchange = () => setPermission(status.state);
        }).catch(() => setPermission('prompt'));
        return () => { cancelled = true; };
    }, [requestLocation]);

    const url = latitude && longitude
        ? `/api/stations/nearby?lat=${latitude.toFixed(5)}&lng=${longitude.toFixed(5)}&limit=2&sistema=TransMilenio`
        : null;
    const { data, loading } = useLiveData<{ stations: Nearby[] }>(url);
    const station = data?.stations?.[0];

    if (!latitude || !longitude) {
        return (
            <section className="rounded-2xl border border-border p-4" aria-label="Estación cercana">
                <h2 className="font-signage text-[22px] font-bold leading-tight">Llegadas cerca de ti</h2>
                <p className="text-[14px] text-muted-foreground mt-1 mb-3">
                    {geoError || (permission === 'denied'
                        ? 'La ubicación está bloqueada. Actívala en los permisos del navegador para ver tu estación más cercana.'
                        : 'Usa tu ubicación para ver qué buses llegan a la estación más cercana.')}
                </p>
                {permission !== 'denied' && (
                    <button
                        onClick={requestLocation}
                        disabled={locating}
                        className="inline-flex items-center gap-2 h-10 px-4 rounded-full bg-foreground text-background text-[14px] font-semibold active:scale-95 transition disabled:opacity-60"
                    >
                        <LocateFixed className={locating ? 'w-4 h-4 animate-spin' : 'w-4 h-4'} />
                        {locating ? 'Buscando…' : 'Usar mi ubicación'}
                    </button>
                )}
            </section>
        );
    }

    if (loading && !station) {
        return <div className="h-64 rounded-2xl bg-secondary animate-pulse" />;
    }

    if (!station) return null;

    const planQuery = new URLSearchParams({ toLat: String(station.lat), toLng: String(station.lng), toName: `Estación ${station.nombre}` });

    return (
        <section aria-label={`Llegadas en ${station.nombre}`}>
            <div className="flex items-end justify-between gap-3 mb-2.5">
                <div className="min-w-0">
                    <p className="text-[13px] text-muted-foreground">Estación más cercana</p>
                    <h2 className="font-signage text-[26px] font-bold leading-none truncate">{station.nombre}</h2>
                    <p className="text-[13px] text-muted-foreground mt-1 tabular">
                        {formatDistance(station.distanceM)} · {walkMinutes(station.distanceM)} min caminando
                    </p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                    <Link href={`/planear?${planQuery.toString()}`} className="w-10 h-10 rounded-full border border-border flex items-center justify-center hover:bg-accent active:scale-90 transition" aria-label={`Cómo llegar a ${station.nombre}`}>
                        <Navigation className="w-[18px] h-[18px]" />
                    </Link>
                    <Link href={`/mapa?estacion=${encodeURIComponent(station.codigo)}`} className="w-10 h-10 rounded-full border border-border flex items-center justify-center hover:bg-accent active:scale-90 transition" aria-label={`Ver ${station.nombre} en el mapa`}>
                        <Map className="w-[18px] h-[18px]" />
                    </Link>
                </div>
            </div>
            <ArrivalBoard paradero={station.codigo} title="Próximas llegadas" limit={5} />
        </section>
    );
}
