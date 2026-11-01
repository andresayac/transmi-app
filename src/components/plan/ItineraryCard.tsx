'use client';

import { ChevronRight, Footprints, Repeat } from 'lucide-react';
import type { Itinerary } from '@/types/transit';
import SegmentBar from '@/components/transit/SegmentBar';
import { addMinutes, formatTime } from '@/lib/schedule';
import { formatDistance } from '@/lib/geo';
import NextDepartureHint from './NextDepartureHint';
import { TAG_LABELS, transferCount, transferText } from './utils';
import { cn } from '@/lib/utils';

interface ItineraryCardProps {
    itinerary: Itinerary;
    /** Wall-clock departure (now or scheduled) */
    departAt: Date | null;
    live: boolean;
    onSelect: () => void;
    /** Computers: pointing at the card shows it on the map beside the list */
    onPreview?: () => void;
    /** It's the one on that map */
    onMap?: boolean;
}

export default function ItineraryCard({ itinerary, departAt, live, onSelect, onPreview, onMap = false }: ItineraryCardProps) {
    const firstRide = itinerary.legs.find((l) => l.mode === 'TRANSIT');
    const transfers = transferCount(itinerary);

    return (
        <button
            type="button"
            onClick={onSelect}
            onMouseEnter={onPreview}
            onFocus={onPreview}
            aria-current={onMap || undefined}
            className={cn('route-card w-full text-left rounded-2xl border border-border bg-card p-4 hover:border-foreground/30 focus-visible:border-foreground', onMap && 'border-foreground hover:border-foreground')}
            aria-label={`Opción de ${itinerary.durationMin} minutos, ${transferText(transfers)}`}
        >
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="font-signage tabular text-34 font-bold leading-none text-foreground">
                        {itinerary.durationMin}<span className="text-20 font-semibold ml-1">min</span>
                    </p>
                    {departAt && (
                        <p className="mt-1 text-13 text-muted-foreground tabular">
                            {formatTime(departAt)} → {formatTime(addMinutes(departAt, itinerary.durationMin))}
                        </p>
                    )}
                </div>
                <div className="flex flex-wrap justify-end gap-1.5 max-w-[55%]">
                    {itinerary.tags.map((t) => (
                        <span key={t} className={cn('px-2 py-0.5 rounded-full text-11 font-semibold', t === 'fastest' ? 'bg-foreground text-background' : 'bg-secondary text-foreground')}>
                            {TAG_LABELS[t]}
                        </span>
                    ))}
                </div>
            </div>

            <SegmentBar legs={itinerary.legs} className="mt-3" />

            <div className="mt-3 flex items-center gap-4 text-13 text-muted-foreground">
                <span className="inline-flex items-center gap-1.5"><Footprints className="w-3.5 h-3.5" />{formatDistance(itinerary.walkMeters)}</span>
                <span className="inline-flex items-center gap-1.5"><Repeat className="w-3.5 h-3.5" />{transferText(transfers)}</span>
                <ChevronRight className="w-4 h-4 ml-auto" />
            </div>

            {live && firstRide && <NextDepartureHint leg={firstRide} className="mt-2.5" />}
        </button>
    );
}

export function ItineraryCardSkeleton() {
    return (
        <div className="rounded-2xl border border-border bg-card p-4">
            <div className="h-8 w-24 rounded skeleton" />
            <div className="mt-2 h-3 w-32 rounded skeleton" />
            <div className="mt-3 h-7 w-full rounded-md skeleton" />
            <div className="mt-3 h-3 w-40 rounded skeleton" />
        </div>
    );
}
