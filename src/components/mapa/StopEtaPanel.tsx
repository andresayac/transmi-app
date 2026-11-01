'use client';

import Link from 'next/link';
import { Accessibility, Navigation, RefreshCw, X } from 'lucide-react';
import { useLiveData } from '@/hooks/useLiveData';
import type { RouteStopDetail, StopEta } from '@/types/transit';
import OccupancyMeter, { occupancyInfo } from '@/components/transit/OccupancyMeter';
import RouteBadge from '@/components/transit/RouteBadge';
import { formatDistance } from '@/lib/geo';
import { cn } from '@/lib/utils';

interface Props {
    route: { id: string; codigo: string; nombre: string; color: string };
    stop: RouteStopDetail;
    onClose: () => void;
}

/** Next buses of this route at the selected stop, refreshed every 30 s. */
export default function StopEtaPanel({ route, stop, onClose }: Props) {
    const url = `/api/eta?estacion=${encodeURIComponent(stop.code)}&ruta=${encodeURIComponent(route.codigo)}&idRuta=${encodeURIComponent(route.id)}&nombre=${encodeURIComponent(route.nombre)}`;
    const { data, error, loading, refresh } = useLiveData<{ etas: StopEta[] }>(url, 30000);
    const etas = (data?.etas || []).slice(0, 4);
    const planHref = `/planear?toLat=${stop.lat}&toLng=${stop.lng}&toName=${encodeURIComponent(stop.name)}`;

    return (
        <section className="rounded-2xl border border-border bg-card p-4" aria-live="polite">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-12 text-muted-foreground">Próximos buses en esta parada</p>
                    <h3 className="font-signage text-22 font-bold leading-tight truncate">{stop.name}</h3>
                    <p className="text-12 text-muted-foreground truncate">
                        {stop.address}{stop.platform ? ` · Vagón ${stop.platform}` : ''}
                    </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                    <button onClick={refresh} className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-accent" aria-label="Actualizar tiempos">
                        <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
                    </button>
                    <button onClick={onClose} className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-accent" aria-label="Cerrar parada">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>

            <div className="mt-3 space-y-2">
                {loading && !data && [0, 1].map((i) => <div key={i} className="h-12 rounded-xl bg-secondary animate-pulse" />)}
                {error && !data && <p className="text-13 text-muted-foreground">No pudimos leer los tiempos de llegada. Toca actualizar para reintentar.</p>}
                {data && etas.length === 0 && (
                    <p className="text-13 text-muted-foreground">No hay buses de la {route.codigo} acercándose a esta parada ahora mismo.</p>
                )}
                {etas.map((eta) => (
                    <div key={eta.vehicleId} className="flex items-center gap-3 rounded-xl bg-secondary px-3 py-2.5">
                        <RouteBadge code={route.codigo} color={route.color} size="xs" />
                        <div className="flex-1 min-w-0">
                            <p className="text-13 font-semibold truncate">{eta.label}</p>
                            <p className="flex items-center gap-2 text-12 text-muted-foreground">
                                <OccupancyMeter value={eta.occupancy} />
                                <span>{occupancyInfo(eta.occupancy).label}</span>
                                {/baja|piso/i.test(eta.accessibility) && <Accessibility className="w-3.5 h-3.5" aria-label={eta.accessibility} />}
                                <span className="tabular">· {formatDistance(eta.distanceM)}</span>
                            </p>
                        </div>
                        <p className="font-signage tabular text-24 font-bold leading-none shrink-0">
                            {eta.minutes <= 0 ? 'Ahora' : <>{eta.minutes}<span className="text-14 font-semibold ml-0.5">min</span></>}
                        </p>
                    </div>
                ))}
            </div>

            <Link
                href={planHref}
                className="mt-3 flex items-center justify-center gap-2 h-11 rounded-xl bg-foreground text-background text-14 font-semibold active:scale-[0.98] transition"
            >
                <Navigation className="w-4 h-4" />
                Ir hasta aquí
            </Link>
        </section>
    );
}
