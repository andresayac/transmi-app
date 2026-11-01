'use client';

import { useLiveData } from '@/hooks/useLiveData';
import type { ArrivalsResponse, PlanLeg } from '@/types/transit';
import type { StationMapEntry } from '@/types/station';
import { cn } from '@/lib/utils';

interface NearbyResponse {
    stations: (StationMapEntry & { distanceM: number })[];
}

/**
 * "Próximo B13: 4 min" for a ride leg: finds the TransMilenio station at the
 * boarding stop and reads its live arrivals for that line.
 */
export default function NextDepartureHint({ leg, className }: { leg: PlanLeg; className?: string }) {
    const code = leg.line?.code || '';
    const { data: nearby } = useLiveData<NearbyResponse>(
        code ? `/api/stations/nearby?lat=${leg.from.lat.toFixed(5)}&lng=${leg.from.lng.toFixed(5)}&limit=1&sistema=TransMilenio` : null,
    );
    const station = nearby?.stations?.[0];
    const usable = station && station.distanceM <= 250 ? station : null;
    const { data } = useLiveData<ArrivalsResponse>(usable ? `/api/llegadas?paradero=${encodeURIComponent(usable.codigo)}` : null, 30000);

    const match = data?.arrivals.find((a) => a.code.toUpperCase() === code.toUpperCase());
    if (!match || match.minutes === null) return null;

    return (
        <span className={cn('inline-flex items-center gap-1.5 text-[13px] font-medium text-foreground', className)}>
            <span className="live-dot" />
            {match.minutes === 0 ? `${code} está llegando` : `Próximo ${code}: ${match.minutes} min`}
        </span>
    );
}
