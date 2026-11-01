'use client';

import Link from 'next/link';
import { Map, PinOff } from 'lucide-react';
import { useAppStore, useHydrated } from '@/stores/app';
import ArrivalBoard from '@/components/transit/ArrivalBoard';

/** The stations the rider checks every day, each with its live departures board. */
export default function PinnedStops() {
    const hydrated = useHydrated();
    const pinned = useAppStore((s) => s.pinnedStops);
    const unpin = useAppStore((s) => s.unpinStop);
    if (!hydrated || pinned.length === 0) return null;

    return (
        <section aria-label="Mis paradas" className="space-y-3">
            <h2 className="font-signage text-22 font-bold">Mis paradas</h2>
            {pinned.map((stop) => (
                <div key={stop.codigo}>
                    <ArrivalBoard paradero={stop.codigo} title={stop.nombre} limit={4} compact />
                    <div className="mt-1.5 flex items-center gap-4 px-1">
                        <Link href={`/mapa?estacion=${encodeURIComponent(stop.codigo)}`} className="inline-flex items-center gap-1.5 text-12 font-semibold text-muted-foreground hover:text-foreground">
                            <Map className="w-3.5 h-3.5" /> Ver en el mapa
                        </Link>
                        <button type="button" onClick={() => unpin(stop.codigo)} className="inline-flex items-center gap-1.5 text-12 font-semibold text-muted-foreground hover:text-foreground">
                            <PinOff className="w-3.5 h-3.5" /> Quitar
                        </button>
                    </div>
                </div>
            ))}
        </section>
    );
}
