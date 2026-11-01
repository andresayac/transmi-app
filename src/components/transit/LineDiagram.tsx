'use client';

import { ReactNode } from 'react';
import { BusFront } from 'lucide-react';
import type { Occupancy } from '@/types/transit';
import { readableOn } from '@/lib/color';
import { occupancyInfo } from './OccupancyMeter';
import { cn } from '@/lib/utils';

export interface DiagramStop {
    id: string;
    name: string;
    sub?: string;
    isPortal?: boolean;
    active?: boolean;
}

export interface DiagramBus {
    id: string;
    /** Fractional stop index: 3.4 = 40% of the way from stop 3 to stop 4 */
    index: number;
    label?: string;
    occupancy?: Occupancy;
}

interface LineDiagramProps {
    color: string;
    stops: DiagramStop[];
    buses?: DiagramBus[];
    /** Fractional index of the rider (trip mode) */
    progress?: number | null;
    /** Index of the stop where the rider gets off (trip mode) */
    destinationIndex?: number;
    onStopClick?: (index: number) => void;
    onBusClick?: (bus: DiagramBus) => void;
    selectedIndex?: number | null;
    renderStopExtra?: (index: number) => ReactNode;
    rowHeight?: number;
    className?: string;
}

const LINE_X = 22; // px from the left edge to the line's center

/**
 * A metro-style strip map of one route: the line in its own color, every
 * stop as a station tick, and the live buses gliding between stops.
 */
export default function LineDiagram({
    color,
    stops,
    buses = [],
    progress = null,
    destinationIndex,
    onStopClick,
    onBusClick,
    selectedIndex = null,
    renderStopExtra,
    rowHeight = 52,
    className,
}: LineDiagramProps) {
    const height = stops.length * rowHeight;
    const yOf = (index: number) => index * rowHeight + rowHeight / 2;
    const busFg = readableOn(color);
    const hasProgress = progress !== null && progress !== undefined;

    return (
        <div className={cn('relative select-none', className)} style={{ height }}>
            {/* The line: traveled part dimmed in trip mode */}
            <div
                className="absolute w-[6px] rounded-full"
                style={{ left: LINE_X - 3, top: yOf(0), height: Math.max(0, yOf(stops.length - 1) - yOf(0)), backgroundColor: color }}
            />
            {hasProgress && (
                <div
                    className="absolute w-[6px] rounded-full bg-background/70 transition-[height] duration-1000"
                    style={{ left: LINE_X - 3, top: yOf(0), height: Math.max(0, yOf(Math.min(progress!, stops.length - 1)) - yOf(0)) }}
                />
            )}

            {/* Stops */}
            {stops.map((stop, i) => {
                const passed = hasProgress && i < Math.floor(progress!);
                const isDest = destinationIndex === i;
                const big = stop.isPortal || i === 0 || i === stops.length - 1 || isDest;
                return (
                    <button
                        key={`${stop.id}-${i}`}
                        type="button"
                        disabled={!onStopClick}
                        onClick={() => onStopClick?.(i)}
                        className={cn(
                            'absolute left-0 right-0 flex items-center text-left rounded-xl transition-colors',
                            onStopClick && 'hover:bg-accent/60 active:bg-accent',
                            selectedIndex === i && 'bg-accent',
                        )}
                        style={{ top: i * rowHeight, height: rowHeight }}
                    >
                        <span className="relative shrink-0 flex items-center justify-center" style={{ width: LINE_X * 2, height: rowHeight }}>
                            <span
                                className={cn('rounded-full bg-background border-[3px] transition-transform', big ? 'w-[18px] h-[18px]' : 'w-3 h-3')}
                                style={{
                                    borderColor: stop.active === false ? 'var(--muted-foreground)' : color,
                                    ...(isDest ? { backgroundColor: color } : {}),
                                }}
                            />
                        </span>
                        <span className={cn('flex-1 min-w-0 pr-2', passed && 'opacity-40')}>
                            <span className={cn('block truncate font-signage leading-tight', big ? 'text-[17px] font-bold' : 'text-[16px] font-medium', stop.active === false && 'line-through text-muted-foreground')}>
                                {stop.name}
                            </span>
                            {stop.sub && <span className="block truncate text-[11px] text-muted-foreground leading-tight mt-0.5">{stop.sub}</span>}
                        </span>
                        {renderStopExtra && <span className="shrink-0 pr-2">{renderStopExtra(i)}</span>}
                    </button>
                );
            })}

            {/* Live buses */}
            {buses.map((bus) => {
                const occ = bus.occupancy ? occupancyInfo(bus.occupancy) : null;
                return (
                    <button
                        key={bus.id}
                        type="button"
                        onClick={() => onBusClick?.(bus)}
                        className="absolute z-10 flex items-center justify-center rounded-full shadow-lg ring-2 ring-background transition-transform duration-[1200ms] ease-out"
                        style={{
                            left: LINE_X - 13,
                            top: 0,
                            width: 26,
                            height: 26,
                            backgroundColor: color,
                            color: busFg,
                            transform: `translateY(${yOf(bus.index) - 13}px)`,
                        }}
                        aria-label={`Bus ${bus.label || ''}${occ ? `, ${occ.label}` : ''}`}
                    >
                        <BusFront className="w-3.5 h-3.5" strokeWidth={2.5} />
                        {occ && occ.bars > 0 && (
                            <span className="absolute -right-0.5 -top-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-background" style={{ backgroundColor: occ.color }} />
                        )}
                    </button>
                );
            })}

            {/* Rider */}
            {hasProgress && (
                <span
                    className="absolute z-20 rounded-full bg-foreground ring-4 ring-background transition-transform duration-1000 ease-out"
                    style={{ left: LINE_X - 9, top: 0, width: 18, height: 18, transform: `translateY(${yOf(Math.min(progress!, stops.length - 1)) - 9}px)` }}
                    aria-label="Tu posición"
                >
                    <span className="absolute inset-0 rounded-full bg-foreground animate-ping opacity-40" />
                </span>
            )}
        </div>
    );
}
