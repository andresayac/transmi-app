'use client';

import { useState } from 'react';
import Link from 'next/link';
import { LocateFixed, Map, Navigation } from 'lucide-react';
import { useLiveData } from '@/hooks/useLiveData';
import ArrivalBoard from '@/components/transit/ArrivalBoard';
import PinStopButton from '@/components/transit/PinStopButton';
import { useAppStore } from '@/stores/app';
import { formatDistance, walkMinutes } from '@/lib/geo';
import { cn } from '@/lib/utils';
import type { StationMapEntry } from '@/types/station';

type Nearby = StationMapEntry & { distanceM: number };
type System = 'TransMilenio' | 'TransMiZonal';

const SYSTEMS: { id: System; label: string; /** other stops worth offering */ withinM: number }[] = [
    { id: 'TransMilenio', label: 'TransMilenio', withinM: 1500 },
    { id: 'TransMiZonal', label: 'SITP', withinM: 400 },
];

/** With no saved choice, show TransMilenio when a station is a short walk away, else the SITP stop. */
const TM_SHORT_WALK_M = 800;

interface NearbyStationProps {
    latitude: number | null;
    longitude: number | null;
    permission: PermissionState | 'unknown';
    locating: boolean;
    error: string | null;
    onRequestLocation: () => void;
}

function nearbyUrl(lat: number, lng: number, sistema: System) {
    return `/api/stations/nearby?lat=${lat.toFixed(5)}&lng=${lng.toFixed(5)}&limit=4&sistema=${sistema}`;
}

/**
 * Live departures where the rider is: the closest TransMilenio station or SITP
 * stop (switchable, the choice is remembered), with the other stops close by,
 * e.g. the one across the street that goes the other way.
 */
export default function NearbyStation({ latitude, longitude, permission, locating, error, onRequestLocation }: NearbyStationProps) {
    const pinned = useAppStore((s) => s.pinnedStops);
    const preference = useAppStore((s) => s.settings.nearbySystem);
    const updateSettings = useAppStore((s) => s.updateSettings);
    const [picked, setPicked] = useState<Partial<Record<System, string>>>({});

    const located = !!latitude && !!longitude;
    const tm = useLiveData<{ stations: Nearby[] }>(latitude && longitude ? nearbyUrl(latitude, longitude, 'TransMilenio') : null);
    const sitp = useLiveData<{ stations: Nearby[] }>(latitude && longitude ? nearbyUrl(latitude, longitude, 'TransMiZonal') : null);
    const lists: Record<System, Nearby[]> = { TransMilenio: tm.data?.stations || [], TransMiZonal: sitp.data?.stations || [] };

    if (!located) {
        return (
            <section className="rounded-2xl border border-border p-4" aria-label="Estación cercana">
                <h2 className="font-signage text-22 font-bold leading-tight">Llegadas cerca de ti</h2>
                <p className="text-14 text-muted-foreground mt-1 mb-3">
                    {error || (permission === 'denied'
                        ? 'La ubicación está bloqueada. Actívala en los permisos del navegador para ver tu estación más cercana.'
                        : 'Usa tu ubicación para ver qué buses llegan a la estación o paradero más cercano.')}
                </p>
                {permission !== 'denied' && (
                    <button
                        onClick={onRequestLocation}
                        disabled={locating}
                        className="inline-flex items-center gap-2 h-10 px-4 rounded-full bg-foreground text-background text-14 font-semibold active:scale-95 transition disabled:opacity-60"
                    >
                        <LocateFixed className={locating ? 'w-4 h-4 animate-spin' : 'w-4 h-4'} />
                        {locating ? 'Buscando…' : 'Usar mi ubicación'}
                    </button>
                )}
            </section>
        );
    }

    const loaded = !!tm.data && !!sitp.data;
    if (!loaded && !lists.TransMilenio.length && !lists.TransMiZonal.length) {
        return (tm.loading || sitp.loading) ? <div className="h-72 rounded-2xl skeleton" /> : null;
    }

    const tmNearest = lists.TransMilenio[0];
    const system: System = preference !== 'auto'
        ? preference
        : tmNearest && (tmNearest.distanceM <= TM_SHORT_WALK_M || !lists.TransMiZonal.length) ? 'TransMilenio' : 'TransMiZonal';
    const config = SYSTEMS.find((s) => s.id === system)!;
    const candidates = lists[system].filter((s, i) => i === 0 || s.distanceM <= config.withinM);
    const stop = candidates.find((s) => s.codigo === picked[system]) || candidates[0];
    const isPinned = !!stop && pinned.some((p) => p.codigo === stop.codigo);

    return (
        <section aria-label="Llegadas cerca de ti">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 mb-3">
                <h2 className="font-signage text-24 font-bold leading-none">Cerca de ti</h2>
                <div role="tablist" aria-label="Sistema" className="inline-grid grid-flow-col auto-cols-fr p-1 rounded-xl bg-secondary">
                    {SYSTEMS.map((s) => {
                        const nearest = lists[s.id][0];
                        const active = s.id === system;
                        return (
                            <button
                                key={s.id}
                                role="tab"
                                aria-selected={active}
                                onClick={() => updateSettings({ nearbySystem: s.id })}
                                className={cn('h-8 px-3 rounded-lg text-13 font-semibold transition whitespace-nowrap', active ? 'bg-background shadow-sm' : 'text-muted-foreground')}
                            >
                                {s.label}
                                {nearest && <span className="ml-1.5 font-medium text-muted-foreground tabular">{formatDistance(nearest.distanceM)}</span>}
                            </button>
                        );
                    })}
                </div>
            </div>

            {!stop ? (
                <p role="tabpanel" className="text-14 text-muted-foreground">
                    {system === 'TransMilenio' ? 'No encontramos estaciones de TransMilenio cerca.' : 'No encontramos paraderos del SITP cerca.'}
                </p>
            ) : (
                <div role="tabpanel" aria-label={`Llegadas en ${stop.nombre}`}>
                    <div className="flex items-end justify-between gap-3 mb-2.5">
                        <div className="min-w-0">
                            <p className="text-13 text-muted-foreground">{system === 'TransMilenio' ? 'Estación' : 'Paradero SITP'}</p>
                            <h3 className="font-signage text-26 font-bold leading-none truncate">{stop.nombre}</h3>
                            <p className="text-13 text-muted-foreground mt-1 tabular truncate">
                                {formatDistance(stop.distanceM)} · {walkMinutes(stop.distanceM)} min caminando
                                {system === 'TransMiZonal' && stop.direccion && <> · {stop.direccion}</>}
                            </p>
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                            <PinStopButton stop={{ codigo: stop.codigo, nombre: stop.nombre, lat: stop.lat, lng: stop.lng, sistema: stop.sistema }} />
                            <Link
                                href={`/planear?${new URLSearchParams({ toLat: String(stop.lat), toLng: String(stop.lng), toName: system === 'TransMilenio' ? `Estación ${stop.nombre}` : `Paradero ${stop.nombre}` }).toString()}`}
                                className="w-10 h-10 rounded-full border border-border flex items-center justify-center hover:bg-accent active:scale-90 transition"
                                aria-label={`Cómo llegar a ${stop.nombre}`}
                            >
                                <Navigation className="w-[18px] h-[18px]" />
                            </Link>
                            <Link
                                href={`/mapa?estacion=${encodeURIComponent(stop.codigo)}`}
                                className="w-10 h-10 rounded-full border border-border flex items-center justify-center hover:bg-accent active:scale-90 transition"
                                aria-label={`Ver ${stop.nombre} en el mapa`}
                            >
                                <Map className="w-[18px] h-[18px]" />
                            </Link>
                        </div>
                    </div>

                    {candidates.length > 1 && (
                        <div className="flex gap-2 overflow-x-auto scrollbar-hidden -mx-4 px-4 pb-1 mb-2.5" aria-label="Otros cerca">
                            {candidates.map((c) => {
                                const active = c.codigo === stop.codigo;
                                return (
                                    <button
                                        key={c.codigo}
                                        onClick={() => setPicked((p) => ({ ...p, [system]: c.codigo }))}
                                        aria-pressed={active}
                                        className={cn(
                                            'shrink-0 h-9 px-3.5 rounded-full border text-13 font-medium whitespace-nowrap transition active:scale-95',
                                            active ? 'bg-foreground text-background border-foreground' : 'border-border hover:bg-accent',
                                        )}
                                    >
                                        <span className="max-w-[150px] truncate inline-block align-bottom">{c.nombre}</span>
                                        <span className={cn('ml-1.5 tabular', active ? 'opacity-70' : 'text-muted-foreground')}>{formatDistance(c.distanceM)}</span>
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {isPinned ? (
                        <p className="text-14 text-muted-foreground rounded-2xl border border-border p-4">
                            Sus llegadas ya están arriba, en Mis paradas.
                        </p>
                    ) : (
                        <ArrivalBoard key={stop.codigo} paradero={stop.codigo} title="Próximas llegadas" limit={5} />
                    )}
                </div>
            )}
        </section>
    );
}
