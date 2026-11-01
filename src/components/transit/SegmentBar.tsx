import { Footprints } from 'lucide-react';
import type { PlanLeg } from '@/types/transit';
import { readableOn } from '@/lib/color';
import { cn } from '@/lib/utils';

/**
 * An itinerary at a glance: one segment per leg, width proportional to time.
 * Walking is a dotted neutral track; rides take the line's color and code.
 */
export default function SegmentBar({ legs, className }: { legs: PlanLeg[]; className?: string }) {
    const total = legs.reduce((s, l) => s + Math.max(1, l.durationMin), 0) || 1;
    return (
        <div className={cn('flex w-full items-center gap-[3px] h-7', className)}>
            {legs.map((leg, i) => {
                const pct = (Math.max(1, leg.durationMin) / total) * 100;
                if (leg.mode === 'WALK') {
                    return (
                        <div key={i} className="h-full flex items-center justify-center rounded-md bg-secondary text-muted-foreground min-w-[22px]" style={{ flexBasis: `${pct}%` }} title={`Caminar ${leg.durationMin} min`}>
                            <Footprints className="w-3.5 h-3.5" />
                        </div>
                    );
                }
                const color = leg.line?.color || '#525252';
                return (
                    <div
                        key={i}
                        className="h-full flex items-center justify-center rounded-md font-signage font-bold text-[14px] tabular min-w-[34px] px-1"
                        style={{ flexBasis: `${pct}%`, backgroundColor: color, color: readableOn(color) }}
                        title={`${leg.line?.code} · ${leg.durationMin} min`}
                    >
                        {leg.line?.code}
                    </div>
                );
            })}
        </div>
    );
}
