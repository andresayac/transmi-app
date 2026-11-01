'use client';

import { Check, ChevronRight, Plus, Share2, Star } from 'lucide-react';
import type { RouteSearchResult } from '@/types/route';
import { formatClock, isActiveNow } from '@/lib/schedule';
import RouteBadge from './RouteBadge';
import { cn } from '@/lib/utils';

interface RouteRowProps {
    route: RouteSearchResult;
    onOpen: (route: RouteSearchResult) => void;
    isFavorite?: boolean;
    onToggleFavorite?: (route: RouteSearchResult) => void;
    onShare?: (route: RouteSearchResult) => void;
    /** Comparison selection */
    selected?: boolean;
    selectionColor?: string;
    onToggleSelect?: (route: RouteSearchResult) => void;
    showSchedule?: boolean;
}

/** One route in a list: signage badge, destination, live status, and quick actions. */
export default function RouteRow({ route, onOpen, isFavorite, onToggleFavorite, onShare, selected, selectionColor, onToggleSelect, showSchedule = true }: RouteRowProps) {
    const schedules = route.horarios?.data || [];
    const active = isActiveNow(schedules);

    return (
        <div className={cn('flex items-center gap-3 py-3 border-b border-border last:border-0', selected && 'bg-accent/50 -mx-2 px-2 rounded-xl border-transparent')}>
            <button onClick={() => onOpen(route)} className="flex items-center gap-3 flex-1 min-w-0 text-left active:opacity-70">
                <RouteBadge code={route.codigo} color={route.color} size="md" inactive={active === false} />
                <span className="flex-1 min-w-0">
                    <span className="flex items-center gap-1.5">
                        <span className="font-signage text-[18px] font-semibold leading-tight truncate">{route.nombre}</span>
                        {active === true && <span className="w-1.5 h-1.5 rounded-full bg-success shrink-0" title="Operando ahora" />}
                    </span>
                    <span className="block text-[12px] text-muted-foreground truncate">
                        {route.tipoServicio}
                        {showSchedule && schedules.length > 0 && (
                            <> · {schedules.map((h) => `${h.convencion} ${formatClock(h.hora_inicio)}–${formatClock(h.hora_fin)}`).join(' · ')}</>
                        )}
                        {active === false && ' · Fuera de horario'}
                    </span>
                </span>
            </button>

            <div className="flex items-center shrink-0 -mr-1">
                {onToggleFavorite && (
                    <button
                        onClick={() => onToggleFavorite(route)}
                        className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-accent active:scale-90 transition"
                        aria-label={isFavorite ? `Quitar ${route.codigo} de guardados` : `Guardar ${route.codigo}`}
                        aria-pressed={isFavorite}
                    >
                        <Star className={cn('w-[18px] h-[18px]', isFavorite ? 'fill-foreground text-foreground' : 'text-muted-foreground')} />
                    </button>
                )}
                {onShare && (
                    <button
                        onClick={() => onShare(route)}
                        className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-accent active:scale-90 transition"
                        aria-label={`Compartir ${route.codigo}`}
                    >
                        <Share2 className="w-[17px] h-[17px] text-muted-foreground" />
                    </button>
                )}
                {onToggleSelect ? (
                    <button
                        onClick={() => onToggleSelect(route)}
                        className={cn('w-9 h-9 rounded-full flex items-center justify-center active:scale-90 transition border', selected ? 'border-transparent' : 'border-border hover:bg-accent')}
                        style={selected ? { backgroundColor: selectionColor } : undefined}
                        aria-label={selected ? `Quitar ${route.codigo} de la comparación` : `Comparar ${route.codigo}`}
                        aria-pressed={selected}
                    >
                        {selected ? <Check className="w-4 h-4 text-white" strokeWidth={3} /> : <Plus className="w-4 h-4 text-muted-foreground" />}
                    </button>
                ) : (
                    <ChevronRight className="w-4 h-4 text-muted-foreground/50" />
                )}
            </div>
        </div>
    );
}
