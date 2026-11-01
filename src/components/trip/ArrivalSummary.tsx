'use client';

import { Flag, Leaf, Share2 } from 'lucide-react';
import type { ActiveTrip, TripLog } from '@/stores/app';
import { formatDistance } from '@/lib/geo';
import RouteBadge from '@/components/transit/RouteBadge';
import SystemStripe from '@/components/brand/SystemStripe';

/** Car emissions avoided, rough: ~0.12 kg CO₂ per km for a city car vs. a shared bus seat. */
const CO2_KG_PER_KM = 0.12;

export default function ArrivalSummary({ trip, log, onDone, onShare }: { trip: ActiveTrip; log: TripLog | null; onDone: () => void; onShare: () => void }) {
    const distanceM = trip.itinerary.legs.reduce((s, l) => s + l.distanceM, 0);
    const co2 = (distanceM / 1000) * CO2_KG_PER_KM;
    const lines = trip.itinerary.legs.filter((l) => l.line);

    return (
        <div className="rounded-3xl border border-border bg-card overflow-hidden animate-slide-up" role="status">
            <SystemStripe />
            <div className="p-5">
                <div className="flex items-center gap-2 text-muted-foreground text-13">
                    <Flag className="w-4 h-4" /> Llegaste
                </div>
                <p className="mt-1 font-signage text-34 font-bold leading-tight">{trip.to.name}</p>
                {lines.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                        {lines.map((l, i) => <RouteBadge key={i} code={l.line!.code} color={l.line!.color} size="sm" />)}
                    </div>
                )}

                <dl className="mt-5 grid grid-cols-3 gap-3">
                    <div>
                        <dt className="text-12 text-muted-foreground">Duración</dt>
                        <dd className="font-signage tabular text-26 font-bold leading-tight">{`${log ? log.durationMin : trip.itinerary.durationMin} min`}</dd>
                    </div>
                    <div>
                        <dt className="text-12 text-muted-foreground">Recorrido</dt>
                        <dd className="font-signage tabular text-26 font-bold leading-tight">{formatDistance(distanceM)}</dd>
                    </div>
                    <div>
                        <dt className="text-12 text-muted-foreground inline-flex items-center gap-1"><Leaf className="w-3 h-3" />CO₂ evitado</dt>
                        <dd className="font-signage tabular text-26 font-bold leading-tight">{co2.toFixed(1)} kg</dd>
                    </div>
                </dl>
                <p className="mt-2 text-11 text-muted-foreground">El CO₂ es un estimado frente a hacer el mismo recorrido en carro particular.</p>

                <div className="mt-5 flex gap-2">
                    <button type="button" onClick={onShare} className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center active:scale-95" aria-label="Compartir viaje">
                        <Share2 className="w-5 h-5" />
                    </button>
                    <button type="button" onClick={onDone} className="flex-1 h-12 rounded-full bg-foreground text-background font-signage text-20 font-bold active:scale-[0.98]">
                        Listo
                    </button>
                </div>
            </div>
        </div>
    );
}
