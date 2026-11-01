'use client';

import { useEffect, useRef } from 'react';
import { BellRing, Footprints } from 'lucide-react';
import type { PlanLeg } from '@/types/transit';
import RouteBadge from '@/components/transit/RouteBadge';
import LineDiagram from '@/components/transit/LineDiagram';
import NextDepartureHint from '@/components/plan/NextDepartureHint';
import { stopLabel } from '@/components/plan/utils';
import { formatDistance, walkMinutes } from '@/lib/geo';

const ROW = 46;

interface CurrentLegProps {
    leg: PlanLeg;
    nextLeg: PlanLeg | null;
    isLastLeg: boolean;
    /** Meters left on this leg */
    remainingM: number;
    /** Fractional stop index on a ride */
    stopProgress: number;
    alarmStops: number;
}

function WalkCard({ leg, nextLeg, isLastLeg, remainingM }: Pick<CurrentLegProps, 'leg' | 'nextLeg' | 'isLastLeg' | 'remainingM'>) {
    const target = isLastLeg ? 'tu destino' : stopLabel(leg.to.name).station;
    const platform = isLastLeg ? null : stopLabel(leg.to.name).platform;
    return (
        <div>
            <div className="flex items-center gap-2 text-muted-foreground text-13">
                <Footprints className="w-4 h-4" /> Caminando
            </div>
            <p className="mt-1 font-signage text-28 font-bold leading-tight">Camina hasta {target}</p>
            {platform && <p className="text-13 text-muted-foreground">{platform}</p>}
            <p className="mt-1 text-15 tabular">
                <span className="font-semibold">{formatDistance(remainingM)}</span>
                <span className="text-muted-foreground"> · unos {walkMinutes(remainingM)} min</span>
            </p>
            {nextLeg?.mode === 'TRANSIT' && nextLeg.line && (
                <div className="mt-4 flex items-center gap-3 rounded-2xl bg-secondary p-3">
                    <RouteBadge code={nextLeg.line.code} color={nextLeg.line.color} size="md" />
                    <div className="min-w-0">
                        <p className="text-14 font-semibold truncate">Luego toma el {nextLeg.line.code}</p>
                        <p className="text-12 text-muted-foreground truncate">Dirección {nextLeg.line.longName || nextLeg.line.name}</p>
                        <NextDepartureHint leg={nextLeg} className="mt-1" />
                    </div>
                </div>
            )}
        </div>
    );
}

function RideCard({ leg, stopProgress, alarmStops }: Pick<CurrentLegProps, 'leg' | 'stopProgress' | 'alarmStops'>) {
    const line = leg.line!;
    const stops = [leg.from, ...(leg.stops || []), leg.to];
    const last = stops.length - 1;
    const passed = Math.min(last, Math.floor(stopProgress));
    const left = Math.max(0, last - passed);
    const next = stopLabel(stops[Math.min(last, passed + 1)].name);
    const exit = stopLabel(leg.to.name);
    const alert = left > 0 && left <= alarmStops;
    const scrollRef = useRef<HTMLDivElement>(null);

    // Keep the rider's position in view on the strip map
    useEffect(() => {
        scrollRef.current?.scrollTo({ top: Math.max(0, passed * ROW - ROW), behavior: 'smooth' });
    }, [passed]);

    return (
        <div>
            <div className="flex items-center gap-3">
                <RouteBadge code={line.code} color={line.color} size="lg" />
                <div className="min-w-0">
                    <p className="text-13 text-muted-foreground">A bordo</p>
                    <p className="text-16 font-semibold truncate">Dirección {line.longName || line.name}</p>
                </div>
            </div>

            {left === 0 ? (
                <p className="mt-4 font-signage text-32 font-bold leading-tight">Bájate aquí: {exit.station}</p>
            ) : (
                <>
                    <p className="mt-4 text-13 text-muted-foreground">Próxima parada</p>
                    <p className="font-signage text-32 font-bold leading-tight">{next.station}</p>
                    <p className="mt-1 text-15">
                        {left === 1 ? 'Te bajas en la próxima' : <>Te bajas en <span className="font-semibold tabular">{left} paradas</span></>}
                        <span className="text-muted-foreground"> · {exit.station}</span>
                    </p>
                </>
            )}

            {alert && (
                <div className="mt-3 flex items-center gap-2.5 rounded-2xl bg-foreground text-background px-4 py-3" role="alert">
                    <BellRing className="w-5 h-5 shrink-0 animate-pulse-dot" />
                    <p className="text-15 font-semibold">Prepárate para bajarte{exit.platform ? ` · ${exit.platform}` : ''}</p>
                </div>
            )}

            <div ref={scrollRef} className="mt-4 max-h-[260px] overflow-y-auto overscroll-contain rounded-2xl border border-border py-1">
                <LineDiagram
                    color={line.color}
                    rowHeight={ROW}
                    progress={stopProgress}
                    destinationIndex={last}
                    stops={stops.map((s, i) => {
                        const { station, platform } = stopLabel(s.name);
                        return { id: s.id || `${i}`, name: station, sub: platform || undefined, isPortal: /portal/i.test(station) };
                    })}
                />
            </div>
        </div>
    );
}

/** What the rider needs right now: where to walk, or which stop is next and when to get off. */
export default function CurrentLeg(props: CurrentLegProps) {
    if (props.leg.mode === 'TRANSIT' && props.leg.line) {
        return <RideCard leg={props.leg} stopProgress={props.stopProgress} alarmStops={props.alarmStops} />;
    }
    return <WalkCard leg={props.leg} nextLeg={props.nextLeg} isLastLeg={props.isLastLeg} remainingM={props.remainingM} />;
}
