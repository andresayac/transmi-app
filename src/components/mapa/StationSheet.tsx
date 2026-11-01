'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Check, ChevronRight, Navigation, X } from 'lucide-react';
import BottomSheet from '@/components/ui/BottomSheet';
import PinStopButton from '@/components/transit/PinStopButton';
import ArrivalBoard from '@/components/transit/ArrivalBoard';
import RouteBadge from '@/components/transit/RouteBadge';
import { transmilenioApi } from '@/services/transmilenio';
import { formatClock, isActiveNow } from '@/lib/schedule';
import type { StationMapEntry } from '@/types/station';
import type { RouteSearchResult } from '@/types/route';
import type { Arrival } from '@/types/transit';
import { cn } from '@/lib/utils';

interface Props {
    station: StationMapEntry;
    onClose: () => void;
    onOpenRoute: (route: RouteSearchResult) => void;
    onViewMany: (routes: RouteSearchResult[]) => void;
}

/** A station: live departures board, then every route that stops here. */
export default function StationSheet({ station, onClose, onOpenRoute, onViewMany }: Props) {
    const [rutas, setRutas] = useState<RouteSearchResult[]>([]);
    const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
    const [selected, setSelected] = useState<Set<string>>(new Set());

    useEffect(() => {
        let cancelled = false;
        transmilenioApi.getRutasByEstacion(station.id)
            .then((data) => {
                if (cancelled) return;
                setRutas(data.filter((r, i, arr) => arr.findIndex((x) => x.id === r.id) === i));
                setStatus('ready');
            })
            .catch(() => {
                if (!cancelled) setStatus('error');
            });
        return () => {
            cancelled = true;
        };
    }, [station.id]);

    const sorted = useMemo(() => {
        const rank = (r: RouteSearchResult) => (isActiveNow(r.horarios?.data) === false ? 1 : 0);
        return [...rutas].sort((a, b) => rank(a) - rank(b) || a.codigo.localeCompare(b.codigo, 'es', { numeric: true }));
    }, [rutas]);

    const toggle = (id: string) => setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
    });

    const openArrival = (a: Arrival) => {
        const match = rutas.find((r) => r.codigo === a.code && (r.nombre === a.destination || a.destination.includes(r.nombre) || r.nombre.includes(a.destination)))
            || rutas.find((r) => r.codigo === a.code);
        if (match) onOpenRoute(match);
    };

    const isTroncal = station.sistema === 'TransMilenio';
    const planHref = `/planear?toLat=${station.lat}&toLng=${station.lng}&toName=${encodeURIComponent(station.nombre)}`;

    return (
        <BottomSheet
            snaps={[168, 0.58, 0.9]}
            header={
                <div className="px-4 pb-3">
                    <div className="flex items-start gap-3">
                        <span
                            className={cn('mt-1 shrink-0 border-[3px] border-foreground bg-background', isTroncal ? 'w-5 h-5 rounded-[5px]' : 'w-4 h-4 rounded-full border-muted-foreground')}
                            aria-hidden
                        />
                        <div className="flex-1 min-w-0">
                            <h2 className="font-signage text-[24px] font-bold leading-tight truncate">{station.nombre}</h2>
                            <p className="text-[13px] text-muted-foreground truncate">
                                {isTroncal ? 'Estación TransMilenio' : 'Paradero zonal'} · {station.direccion}
                            </p>
                        </div>
                        <button onClick={onClose} onPointerDown={(e) => e.stopPropagation()} className="w-10 h-10 -mr-1 rounded-full flex items-center justify-center hover:bg-accent shrink-0" aria-label="Cerrar estación">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    <div className="mt-3 flex gap-2" onPointerDown={(e) => e.stopPropagation()}>
                        <Link href={planHref} className="h-10 px-4 rounded-full bg-foreground text-background flex items-center gap-2 text-[14px] font-semibold active:scale-95 transition">
                            <Navigation className="w-4 h-4" />
                            Cómo llegar
                        </Link>
                        <PinStopButton stop={{ codigo: station.codigo, nombre: station.nombre, lat: station.lat, lng: station.lng, sistema: station.sistema }} />
                        <span className="h-10 px-3 rounded-full border border-border flex items-center text-[13px] text-muted-foreground tabular">{station.codigo}</span>
                    </div>
                </div>
            }
        >
            <div className="px-4 pb-28 space-y-5">
                <ArrivalBoard
                    paradero={station.codigo}
                    title="Próximas llegadas"
                    limit={8}
                    onSelect={status === 'ready' && rutas.length ? openArrival : undefined}
                />

                <section>
                    <h3 className="font-signage text-[19px] font-bold mb-1">Rutas que paran aquí</h3>
                    <p className="text-[12px] text-muted-foreground mb-2">Marca varias para comparar sus buses en vivo, o toca una para ver su recorrido.</p>

                    {status === 'loading' && (
                        <div className="space-y-2" aria-hidden>
                            {[0, 1, 2].map((i) => <div key={i} className="h-14 rounded-xl bg-secondary animate-pulse" />)}
                        </div>
                    )}
                    {status === 'error' && <p className="text-[14px] text-muted-foreground">No pudimos cargar las rutas de esta estación. Cierra y vuelve a abrirla para reintentar.</p>}
                    {status === 'ready' && sorted.length === 0 && (
                        <p className="text-[14px] text-muted-foreground">
                            {isTroncal ? 'Esta estación no tiene rutas publicadas.' : 'Las rutas de los paraderos zonales aparecen en el tablero de llegadas de arriba.'}
                        </p>
                    )}

                    <ul className="divide-y divide-border">
                        {sorted.map((r) => {
                            const active = isActiveNow(r.horarios?.data);
                            const checked = selected.has(r.id);
                            return (
                                <li key={r.id} className="flex items-center gap-2 py-1">
                                    <button
                                        onClick={() => toggle(r.id)}
                                        className={cn('w-9 h-9 shrink-0 flex items-center justify-center rounded-full hover:bg-accent')}
                                        role="checkbox"
                                        aria-checked={checked}
                                        aria-label={`Comparar ${r.codigo}`}
                                    >
                                        <span className={cn('w-5 h-5 rounded-md border-2 flex items-center justify-center transition', checked ? 'bg-foreground border-foreground' : 'border-muted-foreground/50')}>
                                            {checked && <Check className="w-3.5 h-3.5 text-background" strokeWidth={3} />}
                                        </span>
                                    </button>
                                    <button onClick={() => onOpenRoute(r)} className="flex-1 min-w-0 flex items-center gap-3 py-2 text-left rounded-xl active:opacity-70">
                                        <RouteBadge code={r.codigo} color={r.color} size="md" inactive={active === false} />
                                        <span className="flex-1 min-w-0">
                                            <span className="flex items-center gap-1.5">
                                                <span className="font-signage text-[17px] font-semibold truncate">{r.nombre}</span>
                                                {active === true && <span className="live-dot shrink-0" aria-label="Operando ahora" />}
                                            </span>
                                            <span className="block text-[12px] text-muted-foreground truncate">
                                                {active === false ? 'Fuera de horario · ' : ''}
                                                {(r.horarios?.data || []).map((h) => `${h.convencion} ${formatClock(h.hora_inicio)}–${formatClock(h.hora_fin)}`).join(' · ') || r.tipoServicio}
                                            </span>
                                        </span>
                                        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </section>
            </div>

            {selected.size > 0 && (
                <div className="sticky bottom-0 px-4 pt-2 pb-[calc(env(safe-area-inset-bottom)+12px)] bg-gradient-to-t from-background via-background to-transparent">
                    <button
                        onClick={() => onViewMany(rutas.filter((r) => selected.has(r.id)))}
                        className="w-full h-12 rounded-full bg-foreground text-background text-[15px] font-semibold active:scale-[0.98] transition"
                    >
                        Ver buses de {selected.size} {selected.size === 1 ? 'ruta' : 'rutas'}
                    </button>
                </div>
            )}
        </BottomSheet>
    );
}
