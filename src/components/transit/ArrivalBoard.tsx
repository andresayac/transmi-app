'use client';

import { useMemo } from 'react';
import { RefreshCw } from 'lucide-react';
import { useLiveData } from '@/hooks/useLiveData';
import type { Arrival, ArrivalsResponse } from '@/types/transit';
import RouteBadge from './RouteBadge';
import FlapText from './FlapText';
import { cn } from '@/lib/utils';

function minutesText(a: Arrival): string {
    if (a.minutes === 0) return 'Ahora';
    if (a.minutes === null) return '—';
    return `${a.minutes} min`;
}

interface ArrivalBoardProps {
    /** Station or stop code, e.g. TM0002 */
    paradero: string;
    title?: string;
    limit?: number;
    className?: string;
    /** Called when a row is tapped */
    onSelect?: (arrival: Arrival) => void;
    compact?: boolean;
    /** Route code to emphasize (moved to the top when it's on the board) */
    highlight?: string;
}

/**
 * Live departures board for a station. Always dark — it's a piece of station
 * furniture, not a card — with split-flap transitions when times change.
 */
export default function ArrivalBoard({ paradero, title, limit = 6, className, onSelect, compact, highlight }: ArrivalBoardProps) {
    const wanted = highlight?.trim().toUpperCase() || '';
    const { data, error, loading, refresh, updatedAt } = useLiveData<ArrivalsResponse>(
        paradero ? `/api/llegadas?paradero=${encodeURIComponent(paradero)}` : null,
        30000,
    );

    const rows = useMemo(() => {
        const seen = new Set<string>();
        const unique = (data?.arrivals || []).filter((a) => {
            const key = `${a.code}|${a.destination}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
        // Stable sort: the requested route first, everything else keeps its time order
        if (wanted) unique.sort((a, b) => Number(b.code.toUpperCase() === wanted) - Number(a.code.toUpperCase() === wanted));
        return unique.slice(0, limit);
    }, [data, limit, wanted]);
    const wantedMissing = !!wanted && !!data && !rows.some((a) => a.code.toUpperCase() === wanted);

    return (
        <div className={cn('rounded-2xl bg-black text-white overflow-hidden ring-1 ring-white/10', className)}>
            {title !== undefined && (
                <div className="flex items-center justify-between px-4 pt-3 pb-2">
                    <div className="flex items-center gap-2 min-w-0">
                        <span className="live-dot shrink-0" />
                        <span className="font-signage text-17 font-semibold truncate">{title}</span>
                    </div>
                    <button
                        onClick={refresh}
                        className="flex items-center gap-1 text-11 text-white/50 hover:text-white/80 active:scale-95 transition"
                        aria-label="Actualizar llegadas"
                    >
                        <RefreshCw className={cn('w-3 h-3', loading && 'animate-spin')} />
                        {updatedAt ? new Date(updatedAt).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' }) : ''}
                    </button>
                </div>
            )}

            <div className="divide-y divide-white/[0.07]">
                {loading && !data && Array.from({ length: Math.min(3, limit) }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-3">
                        <div className="h-6 w-10 rounded-md bg-white/10 animate-pulse" />
                        <div className="h-3 flex-1 rounded bg-white/10 animate-pulse" />
                        <div className="h-5 w-12 rounded bg-white/10 animate-pulse" />
                    </div>
                ))}

                {!loading && !error && data && rows.length === 0 && (
                    <p className="px-4 py-5 text-13 text-white/50">No hay buses próximos reportados en este momento.</p>
                )}

                {error && !data && (
                    <p className="px-4 py-5 text-13 text-white/60">
                        No pudimos leer las llegadas. <button onClick={refresh} className="underline underline-offset-2">Reintentar</button>
                    </p>
                )}

                {wantedMissing && (
                    <p className="px-4 py-2.5 text-13 text-white/60">La {wanted} no aparece en las próximas llegadas. Estas son las demás rutas:</p>
                )}

                {rows.map((a) => {
                    const arriving = a.minutes === 0;
                    const isWanted = !!wanted && a.code.toUpperCase() === wanted;
                    return (
                        <button
                            key={`${a.code}|${a.destination}`}
                            onClick={() => onSelect?.(a)}
                            disabled={!onSelect}
                            className={cn('w-full flex items-center gap-3 px-4 text-left', compact ? 'py-2' : 'py-2.5', onSelect && 'active:bg-white/5', isWanted && 'bg-white/[0.09]')}
                        >
                            <RouteBadge code={a.code} color={a.color} size="sm" />
                            <div className="flex-1 min-w-0">
                                <FlapText value={a.destination} className="block truncate font-signage text-16 font-medium text-white/90" stagger={12} />
                                {!compact && <span className="block text-11 text-white/40 tabular">{a.distanceLabel}</span>}
                            </div>
                            <FlapText
                                value={minutesText(a)}
                                className={cn('font-signage tabular text-20 font-bold shrink-0', arriving ? 'text-[#FCBD1B]' : 'text-white')}
                            />
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
