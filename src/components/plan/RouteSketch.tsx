'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Map as MapIcon } from 'lucide-react';
import { fitToBox, type LngLat } from '@/lib/geo';
import { cn } from '@/lib/utils';
import type { ItineraryMapProps } from './ItineraryMap';

const DEFAULT_PAD = { top: 70, bottom: 50, left: 50, right: 50 };

/**
 * The trip drawn from its own geometry, like a line diagram: no tiles, no
 * downloads. Rides keep their route color inside a contrasting casing, so
 * every color reads on both themes; walking is dotted.
 */
export default function RouteSketch({ itinerary, from, to, rider, padding, className, onShowMap }: ItineraryMapProps & { onShowMap: () => void }) {
    const boxRef = useRef<HTMLDivElement>(null);
    const [size, setSize] = useState<{ w: number; h: number } | null>(null);

    useEffect(() => {
        const el = boxRef.current;
        if (!el) return;
        const observer = new ResizeObserver(([entry]) => {
            const { width, height } = entry.contentRect;
            setSize({ w: Math.round(width), h: Math.round(height) });
        });
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    const drawing = useMemo(() => {
        if (!size) return null;
        const legs = itinerary.legs.filter((l) => l.geometry.length > 1);
        const points: LngLat[] = [...legs.flatMap((l) => l.geometry), [from.lng, from.lat], [to.lng, to.lat]];
        if (rider) points.push([rider.lng, rider.lat]);
        const pad = padding || DEFAULT_PAD;
        const project = fitToBox(points, size.w, size.h, { ...pad, bottom: pad.bottom + 24 });
        const path = (coords: LngLat[]) => coords.map((c, i) => `${i ? 'L' : 'M'}${project(c).map((n) => n.toFixed(1)).join(' ')}`).join('');
        return {
            walks: legs.filter((l) => l.mode === 'WALK').map((l) => path(l.geometry)),
            rides: legs.filter((l) => l.mode === 'TRANSIT').map((l) => ({
                d: path(l.geometry),
                color: l.line?.color || '#525252',
                ends: [project([l.from.lng, l.from.lat]), project([l.to.lng, l.to.lat])],
                stops: (l.stops || []).map((s) => project([s.lng, s.lat])),
            })),
            from: project([from.lng, from.lat]),
            to: project([to.lng, to.lat]),
            rider: rider ? project([rider.lng, rider.lat]) : null,
        };
    }, [size, itinerary, from, to, rider, padding]);

    return (
        <div ref={boxRef} className={cn('relative w-full h-full overflow-hidden bg-secondary text-foreground', className)}>
            {drawing && size && (
                <svg width={size.w} height={size.h} className="absolute inset-0" role="img" aria-label={`Esquema del recorrido hacia ${to.name}`}>
                    <defs>
                        <pattern id="sketch-grid" width="22" height="22" patternUnits="userSpaceOnUse">
                            <circle cx="1" cy="1" r="1" fill="currentColor" opacity="0.12" />
                        </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#sketch-grid)" />
                    {drawing.walks.map((d, i) => (
                        <path key={`w${i}`} d={d} fill="none" stroke="currentColor" strokeOpacity={0.7} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="0.1 8" />
                    ))}
                    {drawing.rides.map((r, i) => (
                        <g key={`r${i}`}>
                            <path d={r.d} fill="none" stroke="currentColor" strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" />
                            <path d={r.d} fill="none" stroke={r.color} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
                            {r.stops.map(([x, y], j) => <circle key={j} cx={x} cy={y} r={2.2} fill="var(--background)" />)}
                            {r.ends.map(([x, y], j) => <circle key={`e${j}`} cx={x} cy={y} r={6.5} fill="var(--background)" stroke={r.color} strokeWidth={3.5} />)}
                        </g>
                    ))}
                    <circle cx={drawing.from[0]} cy={drawing.from[1]} r={8} fill="var(--background)" stroke="currentColor" strokeWidth={5} />
                    <rect x={drawing.to[0] - 11} y={drawing.to[1] - 11} width={22} height={22} rx={6} fill="currentColor" stroke="var(--background)" strokeWidth={3} />
                    <rect x={drawing.to[0] - 3.5} y={drawing.to[1] - 3.5} width={7} height={7} rx={1.5} fill="var(--background)" />
                    {drawing.rider && (
                        <g>
                            <circle cx={drawing.rider[0]} cy={drawing.rider[1]} r={16} fill="currentColor" opacity={0.15} />
                            <circle cx={drawing.rider[0]} cy={drawing.rider[1]} r={8} fill="currentColor" stroke="var(--background)" strokeWidth={4} />
                        </g>
                    )}
                </svg>
            )}
            <div className="absolute left-3 bottom-3 flex items-center gap-2">
                <button
                    type="button"
                    onClick={onShowMap}
                    className="h-9 pl-3 pr-3.5 rounded-full glass shadow-lg inline-flex items-center gap-1.5 text-13 font-semibold text-foreground active:scale-95"
                >
                    <MapIcon className="w-4 h-4" /> Ver mapa
                </button>
                <span className="text-12 font-medium text-muted-foreground">Ahorrando datos</span>
            </div>
        </div>
    );
}
