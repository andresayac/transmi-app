import { Footprints } from 'lucide-react';
import type { PlanLeg } from '@/types/transit';
import { readableOn } from '@/lib/color';
import { cn } from '@/lib/utils';

/**
 * An itinerary at a glance: one segment per leg, width proportional to time.
 * Rides never shrink below their route code (so "2-10" never wraps); short walks
 * give up their space first. Walking is a neutral track; rides take the line's color.
 */
export default function SegmentBar({ legs, className }: { legs: PlanLeg[]; className?: string }) {
    return (
        <div className={cn('flex w-full items-stretch gap-[3px] h-7 overflow-hidden', className)}>
            {legs.map((leg, i) => {
                const grow = Math.max(1, leg.durationMin);
                if (leg.mode === 'WALK') {
                    return (
                        <div
                            key={i}
                            className="flex items-center justify-center rounded-md bg-secondary text-muted-foreground"
                            style={{ flex: `${grow} 1 0%`, minWidth: 18 }}
                            title={`Caminar ${leg.durationMin} min`}
                        >
                            <Footprints className="w-3.5 h-3.5 shrink-0" />
                        </div>
                    );
                }
                const color = leg.line?.color || '#525252';
                return (
                    <div
                        key={i}
                        className="flex items-center justify-center rounded-md px-1.5 font-signage font-bold text-14 leading-none tabular whitespace-nowrap"
                        style={{ flex: `${grow} 1 0%`, minWidth: 'max-content', backgroundColor: color, color: readableOn(color) }}
                        title={`${leg.line?.code} · ${leg.durationMin} min`}
                    >
                        {leg.line?.code}
                    </div>
                );
            })}
        </div>
    );
}
