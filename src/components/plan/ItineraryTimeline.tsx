'use client';

import { useState } from 'react';
import { AlertTriangle, ChevronDown, CircleDot, Flag, Footprints } from 'lucide-react';
import type { Itinerary, PlanLeg, PlanPlace } from '@/types/transit';
import RouteBadge from '@/components/transit/RouteBadge';
import LineDiagram from '@/components/transit/LineDiagram';
import { addMinutes, formatTime } from '@/lib/schedule';
import { stopLabel } from './utils';
import { cn } from '@/lib/utils';

function TimeCell({ at }: { at: Date | null }) {
    return <span className="w-14 shrink-0 pt-0.5 text-right text-12 text-muted-foreground tabular">{at ? formatTime(at) : ''}</span>;
}

function StopName({ name, className }: { name: string; className?: string }) {
    const { station, platform } = stopLabel(name);
    return (
        <span className={className}>
            <span className="font-signage text-18 font-semibold text-foreground">{station}</span>
            {platform && <span className="block text-12 text-muted-foreground">{platform}</span>}
        </span>
    );
}

function RideStep({ leg, at }: { leg: PlanLeg; at: Date | null }) {
    const [open, setOpen] = useState(false);
    const line = leg.line!;
    const stops = [leg.from, ...(leg.stops || []), leg.to];
    const count = stops.length - 1;

    return (
        <li className="flex gap-3">
            <TimeCell at={at} />
            <div className="relative flex flex-col items-center w-6 shrink-0">
                <span className="w-3.5 h-3.5 rounded-full border-[3px] bg-background z-10 mt-1" style={{ borderColor: line.color }} />
                <span className="flex-1 w-[6px] rounded-full -mt-0.5" style={{ backgroundColor: line.color }} />
            </div>
            <div className="flex-1 min-w-0 pb-5">
                <StopName name={leg.from.name} className="block" />
                <div className="mt-2 flex items-center gap-2.5">
                    <RouteBadge code={line.code} color={line.color} size="md" />
                    <div className="min-w-0">
                        <p className="text-14 font-semibold text-foreground truncate">Dirección {line.longName || line.name}</p>
                        <p className="text-12 text-muted-foreground">{leg.durationMin} min · {leg.distanceText}</p>
                    </div>
                </div>
                {!!leg.suspendedStops && (
                    <p className="mt-2 flex items-center gap-1.5 text-12 font-medium text-warning">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        {leg.suspendedStops === 1 ? '1 parada suspendida' : `${leg.suspendedStops} paradas suspendidas`} en este tramo
                    </p>
                )}
                <button
                    type="button"
                    onClick={() => setOpen((v) => !v)}
                    className="mt-2 inline-flex items-center gap-1 text-13 font-semibold text-foreground hover:underline underline-offset-2"
                    aria-expanded={open}
                >
                    {count === 1 ? '1 parada' : `${count} paradas`}
                    <ChevronDown className={cn('w-4 h-4 transition-transform', open && 'rotate-180')} />
                </button>
                {open && (
                    <LineDiagram
                        className="mt-2 -ml-1"
                        color={line.color}
                        rowHeight={44}
                        destinationIndex={stops.length - 1}
                        stops={stops.map((s, i) => {
                            const { station, platform } = stopLabel(s.name);
                            return { id: s.id || `${i}`, name: station, sub: platform || undefined, isPortal: /portal/i.test(station) };
                        })}
                    />
                )}
            </div>
        </li>
    );
}

function WalkStep({ leg, at, isLast }: { leg: PlanLeg; at: Date | null; isLast: boolean }) {
    const target = isLast ? 'tu destino' : stopLabel(leg.to.name).station;
    return (
        <li className="flex gap-3">
            <TimeCell at={at} />
            <div className="relative flex flex-col items-center w-6 shrink-0">
                <Footprints className="w-4 h-4 mt-0.5 text-muted-foreground z-10 bg-background" />
                <span className="flex-1 border-l-[3px] border-dotted border-muted-foreground/50 mt-1" />
            </div>
            <div className="flex-1 min-w-0 pb-5">
                <p className="text-14 text-foreground">
                    Camina <span className="font-semibold">{leg.durationMin} min</span> ({leg.distanceText}) hasta {target}
                </p>
            </div>
        </li>
    );
}

/** Step-by-step itinerary with clock times at every step. */
export default function ItineraryTimeline({ itinerary, from, to, departAt }: { itinerary: Itinerary; from: PlanPlace; to: PlanPlace; departAt: Date | null }) {
    const startOffsets = itinerary.legs.map((_, i) => itinerary.legs.slice(0, i).reduce((s, l) => s + l.durationMin, 0));
    const steps = itinerary.legs.map((leg, i) => {
        const at = departAt ? addMinutes(departAt, startOffsets[i]) : null;
        const isLast = i === itinerary.legs.length - 1;
        return leg.mode === 'TRANSIT' && leg.line
            ? <RideStep key={i} leg={leg} at={at} />
            : <WalkStep key={i} leg={leg} at={at} isLast={isLast} />;
    });

    return (
        <ol aria-label="Pasos del recorrido">
            <li className="flex gap-3">
                <TimeCell at={departAt} />
                <div className="relative flex flex-col items-center w-6 shrink-0">
                    <CircleDot className="w-5 h-5 text-foreground z-10" />
                    <span className="flex-1 border-l-[3px] border-dotted border-muted-foreground/50" />
                </div>
                <p className="flex-1 min-w-0 pb-4 font-signage text-18 font-semibold text-foreground truncate">{from.name}</p>
            </li>
            {steps}
            <li className="flex gap-3">
                <TimeCell at={departAt ? addMinutes(departAt, itinerary.durationMin) : null} />
                <div className="flex flex-col items-center w-6 shrink-0">
                    <Flag className="w-5 h-5 text-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="font-signage text-18 font-semibold text-foreground truncate">{to.name}</p>
                    {to.detail && <p className="text-12 text-muted-foreground truncate">{to.detail}</p>}
                </div>
            </li>
        </ol>
    );
}
