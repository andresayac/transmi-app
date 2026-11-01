import type { Occupancy } from '@/types/transit';
import { cn } from '@/lib/utils';

const LEVELS: Record<Occupancy, { bars: number; color: string; label: string }> = {
    VACIO: { bars: 1, color: 'var(--success)', label: 'Con espacio' },
    MEDIO: { bars: 2, color: 'var(--warning)', label: 'Medio lleno' },
    LLENO: { bars: 3, color: 'var(--destructive)', label: 'Lleno' },
    DESCONOCIDO: { bars: 0, color: 'var(--muted-foreground)', label: 'Sin dato' },
};

export function occupancyInfo(o: Occupancy) {
    return LEVELS[o] || LEVELS.DESCONOCIDO;
}

/** Three ascending bars, like a signal meter: how full the bus is. */
export default function OccupancyMeter({ value, showLabel = false, className }: { value: Occupancy; showLabel?: boolean; className?: string }) {
    const level = occupancyInfo(value);
    return (
        <span className={cn('inline-flex items-center gap-1.5', className)} title={level.label} aria-label={`Ocupación: ${level.label}`}>
            <span className="inline-flex items-end gap-[2px] h-3">
                {[1, 2, 3].map((i) => (
                    <span
                        key={i}
                        className="w-[3px] rounded-[1px]"
                        style={{
                            height: `${i * 4}px`,
                            backgroundColor: i <= level.bars ? level.color : 'var(--border)',
                        }}
                    />
                ))}
            </span>
            {showLabel && <span className="text-11 text-muted-foreground">{level.label}</span>}
        </span>
    );
}
