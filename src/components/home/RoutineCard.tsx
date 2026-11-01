'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Briefcase, CreditCard, House, MapPin, Navigation } from 'lucide-react';
import { useAppStore, useHydrated } from '@/stores/app';
import { useLiveData } from '@/hooks/useLiveData';
import { useClock } from '@/components/plan/useClock';
import { useFare } from '@/hooks/useFare';
import { estimateBalance } from '@/lib/balance';
import { stopLabel } from '@/components/plan/utils';
import RouteBadge from '@/components/transit/RouteBadge';
import { leaveInMinutes, suggestRoutine } from '@/lib/routine';
import { nextArrivalFor } from '@/lib/direction';
import { addMinutes, formatTime } from '@/lib/schedule';
import { planHref } from './PlannerHero';
import type { ArrivalsResponse, PlanPlace, PlanResponse } from '@/types/transit';
import type { StationMapEntry } from '@/types/station';

interface Props {
    here: { lat: number; lng: number } | null;
}

/**
 * The morning/evening card: where you're probably going, and when to walk out
 * the door to catch the next bus — from your habits, Casa/Trabajo and live arrivals.
 */
export default function RoutineCard({ here }: Props) {
    const router = useRouter();
    const hydrated = useHydrated();
    const home = useAppStore((s) => s.home);
    const work = useAppStore((s) => s.work);
    const trips = useAppStore((s) => s.trips);
    const lastBalance = useAppStore((s) => s.lastBalance);
    const fare = useFare();
    const now = useClock();

    // Re-evaluate every few minutes (bucket the clock so the plan isn't refetched every tick)
    const bucket = Math.floor(now / (5 * 60000));
    // ~100 m resolution is plenty to decide "already there"
    const hereLat = here ? Math.round(here.lat * 1000) / 1000 : null;
    const hereLng = here ? Math.round(here.lng * 1000) / 1000 : null;
    const suggestion = useMemo(
        () => (hydrated && bucket > 0
            ? suggestRoutine({ now: new Date(bucket * 5 * 60000), home, work, trips, here: hereLat !== null && hereLng !== null ? { lat: hereLat, lng: hereLng } : null })
            : null),
        [hydrated, bucket, home, work, trips, hereLat, hereLng],
    );

    // Where the trip starts: the phone's position, or the other end of the commute
    const from: PlanPlace | null = here
        ? { name: 'Mi ubicación', lat: here.lat, lng: here.lng, kind: 'gps' }
        : suggestion?.reason === 'work' ? home : suggestion?.reason === 'home' ? work : null;

    const planUrl = suggestion && from
        ? `/api/plan?${new URLSearchParams({
            fromLat: from.lat.toFixed(5), fromLng: from.lng.toFixed(5), fromName: from.name,
            toLat: suggestion.place.lat.toFixed(5), toLng: suggestion.place.lng.toFixed(5), toName: suggestion.place.name,
        }).toString()}`
        : null;
    const { data: plan, loading } = useLiveData<PlanResponse>(planUrl, 5 * 60000);
    const itinerary = plan?.itineraries?.[0] || null;

    const firstRideIndex = itinerary ? itinerary.legs.findIndex((l) => l.mode === 'TRANSIT') : -1;
    const firstRide = firstRideIndex >= 0 ? itinerary!.legs[firstRideIndex] : null;
    const walkBefore = itinerary ? itinerary.legs.slice(0, Math.max(0, firstRideIndex)).reduce((s, l) => s + l.durationMin, 0) : 0;

    // Live arrivals at the boarding stop, for the line we need
    const { data: nearby } = useLiveData<{ stations: (StationMapEntry & { distanceM: number })[] }>(
        firstRide ? `/api/stations/nearby?lat=${firstRide.from.lat.toFixed(5)}&lng=${firstRide.from.lng.toFixed(5)}&limit=1` : null,
    );
    const boardingStop = nearby?.stations?.[0] && nearby.stations[0].distanceM < 250 ? nearby.stations[0] : null;
    const { data: arrivals } = useLiveData<ArrivalsResponse>(boardingStop ? `/api/llegadas?paradero=${encodeURIComponent(boardingStop.codigo)}` : null, 30000);
    // Same route code can run both ways (e.g. 8 → Terminal / 8 → Guatoque): match the direction too
    const nextBus = useMemo(() => {
        const line = firstRide?.line;
        if (!line || !arrivals) return null;
        return nextArrivalFor(arrivals.arrivals, line.code, line.longName || line.name);
    }, [firstRide, arrivals]);

    // Known (or estimated) balance below one fare: say so before the rider walks to the station
    const balance = useMemo(() => estimateBalance(lastBalance, trips, fare), [lastBalance, trips, fare]);
    const shortOfFare = !!firstRide && !!balance && balance.value < fare;

    if (!suggestion) return null;

    const Icon = suggestion.reason === 'home' ? House : suggestion.reason === 'work' ? Briefcase : MapPin;
    const leaveIn = nextBus ? leaveInMinutes(nextBus.minutes!, walkBefore) : null;
    const departAt = now ? addMinutes(new Date(now), Math.max(0, leaveIn ?? 0)) : null;
    const arriveAt = departAt && itinerary ? addMinutes(departAt, itinerary.durationMin) : null;

    const start = () => {
        if (!itinerary || !from) return;
        const store = useAppStore.getState();
        store.startTrip({ itinerary, from, to: suggestion.place });
        router.push('/viaje');
    };

    // Can't reach that bus walking: don't say "Sal ya", give the trip length instead
    const missed = leaveIn !== null && leaveIn < -1;
    let headline = '';
    if (!itinerary) headline = loading || !from ? '' : 'Sin rutas ahora';
    else if (leaveIn === null || missed) headline = `Viaje de ${itinerary.durationMin} min`;
    else if (leaveIn > 1) headline = `Sal en ${leaveIn} min`;
    else headline = 'Sal ya';

    return (
        <section aria-label={suggestion.title} className="rounded-2xl border border-border p-4">
            <div className="flex items-center justify-between gap-3">
                <p className="inline-flex items-center gap-2 text-14 font-semibold">
                    <Icon className="w-4 h-4" /> {suggestion.title}
                </p>
                {firstRide?.line && <RouteBadge code={firstRide.line.code} color={firstRide.line.color} size="sm" />}
            </div>

            {!from ? (
                <p className="mt-2 text-14 text-muted-foreground">Activa tu ubicación para saber cuándo salir.</p>
            ) : !itinerary ? (
                loading ? <div className="mt-3 h-10 w-40 rounded-lg skeleton" /> : <p className="mt-2 text-14 text-muted-foreground">El planeador no encontró una ruta para este momento.</p>
            ) : (
                <>
                    <p className="mt-2 font-signage tabular text-40 font-bold leading-none">{headline}</p>
                    <p className="mt-2 text-14 leading-snug text-foreground/85">
                        {firstRide?.line ? (
                            <>
                                {walkBefore > 0 && <>Camina {walkBefore} min a <b>{stopLabel(firstRide.from.name).station}</b> y </>}
                                toma la <b>{firstRide.line.code}</b>
                                {nextBus && !missed && <> (llega en {nextBus.minutes === 0 ? 'este momento' : `${nextBus.minutes} min`})</>}.
                            </>
                        ) : (
                            <>Camina hasta {suggestion.place.name}.</>
                        )}
                        {arriveAt && <> Llegas a las <b>{formatTime(arriveAt)}</b>.</>}
                    </p>
                    {missed && nextBus && firstRide?.line && (
                        <p className="mt-1 text-13 text-muted-foreground">
                            El próximo {firstRide.line.code} pasa en {nextBus.minutes === 0 ? 'este momento' : `${nextBus.minutes} min`}, antes de que alcances a llegar: toma el siguiente.
                        </p>
                    )}
                    {shortOfFare && (
                        <p className="mt-3 flex items-start gap-2 rounded-xl bg-[#FCBD1B]/15 px-3 py-2.5 text-13 font-medium leading-snug">
                            <CreditCard className="w-4 h-4 mt-px shrink-0" />
                            <span>Tu TuLlave no alcanza para el pasaje. Recarga antes de entrar a la estación.</span>
                        </p>
                    )}
                    <div className="mt-4 flex gap-2">
                        <button
                            type="button"
                            onClick={start}
                            className="flex-1 h-11 rounded-full bg-foreground text-background text-14 font-semibold inline-flex items-center justify-center gap-2 active:scale-[0.98]"
                        >
                            <Navigation className="w-4 h-4" /> Iniciar viaje
                        </button>
                        <Link href={planHref(suggestion.place, from.kind === 'gps' ? null : from)} className="h-11 px-4 rounded-full border border-border text-14 font-semibold inline-flex items-center hover:bg-accent">
                            Opciones
                        </Link>
                    </div>
                </>
            )}
        </section>
    );
}
