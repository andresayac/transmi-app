'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { BusFront, Check, Clock, Footprints, ShieldCheck } from 'lucide-react';
import ItineraryMap from '@/components/plan/ItineraryMap';
import RouteBadge from '@/components/transit/RouteBadge';
import SystemStripe from '@/components/brand/SystemStripe';
import { useClock } from '@/components/plan/useClock';
import { stopLabel } from '@/components/plan/utils';
import { useLiveData } from '@/hooks/useLiveData';
import { decodePolyline, toItinerary, type ShareState, type SharedTrip } from '@/lib/tripShare';
import { haversine, projectOnPath, type LngLat } from '@/lib/geo';
import { formatTime } from '@/lib/schedule';
import type { LiveBus } from '@/types/transit';
import { cn } from '@/lib/utils';

/** Links stop being "live" after this long */
const EXPIRES_MS = 6 * 60 * 60 * 1000;
/** Without news from the sender's phone for this long, fall back to the plan's timing */
const STALE_MS = 3 * 60 * 1000;

/** Share of a leg already covered by a point on it (0–1), measured along the line. */
function fractionAlong(geometry: LngLat[], point: { lat: number; lng: number }): { fraction: number; offsetM: number } {
    const path = geometry.map(([lng, lat]) => ({ lat, lng }));
    if (path.length < 2) return { fraction: 0, offsetM: Infinity };
    const cum = [0];
    for (let i = 1; i < path.length; i++) cum.push(cum[i - 1] + haversine(path[i - 1], path[i]));
    const total = cum[cum.length - 1] || 1;
    const { index, offset } = projectOnPath(point, path);
    const i = Math.min(path.length - 2, Math.floor(index));
    const along = cum[i] + (index - i) * (cum[i + 1] - cum[i]);
    return { fraction: Math.max(0, Math.min(1, along / total)), offsetM: offset };
}

const name = (raw: string) => stopLabel(raw).station;

function ago(ms: number): string {
    const min = Math.round(ms / 60000);
    return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${min % 60} min`;
}

/**
 * The follower's view of a shared trip. Follows the bus of the leg in progress
 * with TransMilenio's live positions. `state` comes from the sender's phone
 * (short links): it moves the view to the next leg and the next bus on a
 * transfer. Without it (old #links) the plan's timing fills the gaps.
 */
export default function FollowView({ trip, state = null }: { trip: SharedTrip; state?: ShareState | null }) {
    const now = useClock();
    const { itinerary, from, to } = useMemo(() => toItinerary(trip), [trip]);
    const legs = trip.legs;
    const lastLeg = legs.length - 1;
    const expired = !!now && now - trip.sh * 1000 > EXPIRES_MS;
    const ended = !!state?.ended;
    const stale = !!state && !ended && !!now && now - state.at > STALE_MS;

    // Where the sender is: the phone's latest report, else the moment the link was made
    const baseLeg = Math.min(lastLeg, state ? state.leg : trip.cur);
    const busLabel = state ? state.bus : trip.bus ?? null;
    const legStart = state ? state.since : trip.sh * 1000;
    const plannedEta = state?.eta ?? trip.eta * 1000;

    const leg0 = legs[baseLeg];
    const busLeg = leg0?.m === 'T' && busLabel && !ended && !expired ? leg0 : null;
    const { data, updatedAt } = useLiveData<{ buses: LiveBus[] }>(busLeg ? `/api/live?ruta=${encodeURIComponent(busLeg.c || '')}` : null, 10000);
    const bus = busLeg ? data?.buses.find((b) => b.label === busLabel) || null : null;

    // When that bus reached the sender's stop; keyed by leg and bus, so a transfer starts over
    const busKey = busLeg ? `${baseLeg}|${busLabel}` : '';
    const [alighted, setAlighted] = useState<{ key: string; at: number } | null>(null);
    const geometry = useMemo(() => (busLeg ? decodePolyline(busLeg.g) : []), [busLeg]);
    const progress = bus && geometry.length ? fractionAlong(geometry, bus) : null;
    const onRoute = !!progress && progress.offsetM < 500;
    const alightedAt = alighted && alighted.key === busKey ? alighted.at : null;
    if (busKey && now && progress && onRoute && progress.fraction > 0.97 && alightedAt === null) setAlighted({ key: busKey, at: now });

    const restAfter = (i: number) => legs.slice(i + 1).reduce((s, l) => s + l.d, 0);
    /** Walk the plan forward in time from `start`, beginning at leg `first` */
    const legAt = (first: number, start: number) => {
        let t = start;
        for (let i = first; i < legs.length; i++) {
            t += legs[i].d * 60000;
            if (t > now) return i;
        }
        return lastLeg;
    };

    let etaMs = plannedEta;
    let mode: 'live' | 'estimate' | 'ended' = 'estimate';
    let currentLeg = baseLeg;
    if (ended) {
        mode = 'ended';
        currentLeg = lastLeg;
        etaMs = state!.at;
    } else if (alightedAt !== null) {
        // Off the bus: the rest follows the plan until the phone reports the next leg
        etaMs = alightedAt + restAfter(baseLeg) * 60000;
        currentLeg = baseLeg < lastLeg ? legAt(baseLeg + 1, alightedAt) : baseLeg;
    } else if (busLeg && progress && onRoute) {
        etaMs = now + ((1 - progress.fraction) * busLeg.d + restAfter(baseLeg)) * 60000;
        mode = 'live';
    } else if (!state || stale) {
        currentLeg = legAt(baseLeg, legStart);
    }

    const minutesLeft = Math.max(0, Math.round((etaMs - now) / 60000));
    const overdue = mode !== 'ended' && now > etaMs + 20 * 60000;
    const arrivedProbably = overdue || (minutesLeft === 0 && mode === 'estimate');
    const who = trip.by || 'Tu contacto';
    const arrived = ended && state!.leg >= lastLeg;
    const leg = legs[currentLeg];
    const rider = mode === 'live' && bus ? { lat: bus.lat, lng: bus.lng, heading: bus.bearing } : null;
    const secondsAgo = updatedAt ? Math.max(0, Math.round((now - updatedAt) / 1000)) : null;
    const waitingBus = !ended && leg?.m === 'T' && currentLeg === baseLeg && !busLabel && !!state && !stale;

    return (
        <div className="fixed inset-0 z-40 bg-background flex flex-col max-w-lg mx-auto">
            <div className="relative h-[48dvh] shrink-0">
                <ItineraryMap itinerary={itinerary} from={from} to={to} rider={rider} follow={!!rider} padding={{ top: 70, bottom: 40, left: 40, right: 40 }} />
                <div className="absolute left-3 right-3 top-[max(env(safe-area-inset-top),12px)] flex justify-between pointer-events-none">
                    <span className="glass rounded-full px-3 py-1.5 text-13 font-semibold text-foreground inline-flex items-center gap-2">
                        {mode === 'live' && !expired ? <><span className="live-dot" /> Bus en vivo</> : mode === 'ended' ? <><Check className="w-3.5 h-3.5" /> {arrived ? 'Llegó' : 'Viaje terminado'}</> : <><Clock className="w-3.5 h-3.5" /> Estimado</>}
                    </span>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto -mt-4 relative rounded-t-[22px] bg-background border-t border-border">
                <SystemStripe className="rounded-t-[22px]" />
                <div className="px-5 pt-5 pb-[max(env(safe-area-inset-bottom),24px)]">
                    <p className="text-14 text-muted-foreground">
                        {arrived ? `${who} llegó a` : ended ? `${who} terminó su viaje hacia` : expired ? `${who} viajó hacia` : `${who} va hacia`}
                    </p>
                    <h1 className="font-signage text-32 font-bold leading-tight">{name(trip.to[0])}</h1>

                    {mode === 'ended' ? (
                        <p className="mt-3 rounded-2xl bg-secondary p-4 text-15">
                            {arrived ? 'Llegó a las ' : 'Terminó el viaje a las '}<b>{formatTime(new Date(etaMs))}</b>.
                        </p>
                    ) : expired ? (
                        <p className="mt-3 rounded-2xl bg-secondary p-4 text-14">
                            Este enlace se compartió hace más de 6 horas, así que ya no muestra datos en vivo.
                        </p>
                    ) : (
                        <>
                            <div className="mt-4 flex items-end justify-between gap-3">
                                <div>
                                    <p className="text-13 text-muted-foreground">{arrivedProbably ? 'Debería haber llegado a las' : 'Llega aprox. a las'}</p>
                                    <p className="font-signage tabular text-40 font-bold leading-none">{formatTime(new Date(etaMs))}</p>
                                </div>
                                {!arrivedProbably && (
                                    <p className="font-signage tabular text-30 font-bold leading-none pb-1">
                                        {minutesLeft}<span className="text-18 font-semibold ml-1">min</span>
                                    </p>
                                )}
                            </div>

                            <div className="mt-4 rounded-2xl border border-border p-4">
                                {leg?.m === 'T' && leg.c ? (
                                    <div className="flex items-start gap-3">
                                        <RouteBadge code={leg.c} color={leg.k} size="md" />
                                        <div className="min-w-0">
                                            <p className="text-15 font-semibold">
                                                {mode === 'live' ? `En el bus ${busLabel} hacia ${leg.n}` : waitingBus ? `Va a tomar la ${leg.c} hacia ${leg.n}` : `En bus hacia ${leg.n}`}
                                            </p>
                                            <p className="text-13 text-muted-foreground">
                                                {waitingBus ? `En ${name(leg.f[0])}. Lo verás en vivo apenas suba.` : `Se baja en ${name(leg.t[0])}`}
                                                {mode === 'live' && secondsAgo !== null && ` · posición de hace ${secondsAgo < 60 ? `${secondsAgo} s` : `${Math.round(secondsAgo / 60)} min`}`}
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="flex items-center gap-3 text-15 font-semibold">
                                        <Footprints className="w-5 h-5" /> Caminando hacia {currentLeg === lastLeg ? 'su destino' : name(leg?.t[0] || '')}
                                    </p>
                                )}
                                {busLeg && !bus && data && alightedAt === null && (
                                    <p className="mt-2 text-12 text-muted-foreground">El bus {busLabel} no está reportando posición ahora: mostramos la hora estimada.</p>
                                )}
                                {stale && (
                                    <p className="mt-2 text-12 text-muted-foreground">
                                        El celular de {trip.by || 'tu contacto'} no envía novedades hace {ago(now - state!.at)} (quizás cerró TransMi). Mostramos la hora estimada.
                                    </p>
                                )}
                            </div>
                        </>
                    )}

                    <ol className="mt-5">
                        {legs.map((l, i) => {
                            const done = i < currentLeg || expired || ended;
                            const current = i === currentLeg && !expired && !ended;
                            return (
                                <li key={i} className={cn('flex items-center gap-3 py-2.5 border-b border-border last:border-0', done && 'opacity-45')}>
                                    <span className="w-10 flex justify-center shrink-0">
                                        {done ? <Check className="w-4 h-4" /> : l.m === 'T' && l.c ? <RouteBadge code={l.c} color={l.k} size="xs" /> : <Footprints className="w-4 h-4 text-muted-foreground" />}
                                    </span>
                                    <span className={cn('flex-1 min-w-0 truncate text-14', current && 'font-semibold')}>
                                        {l.m === 'T' ? `${name(l.f[0])} → ${name(l.t[0])}` : i === lastLeg ? `Camina hasta ${name(trip.to[0])}` : `Camina hasta ${name(l.t[0])}`}
                                    </span>
                                    <span className="text-13 text-muted-foreground tabular shrink-0">{l.d} min</span>
                                </li>
                            );
                        })}
                    </ol>

                    <p className="mt-5 flex items-start gap-1.5 text-12 text-muted-foreground">
                        <ShieldCheck className="w-3.5 h-3.5 mt-px shrink-0" />
                        {state
                            ? `Seguimos el bus con los datos en vivo de TransMilenio. El celular de ${trip.by || 'quien comparte'} solo nos dice en qué bus va, nunca su ubicación. Compartido a las ${formatTime(new Date(trip.sh * 1000))}.`
                            : `Seguimos el bus con los datos en vivo de TransMilenio, no el celular de ${trip.by || 'quien comparte'}. Compartido a las ${formatTime(new Date(trip.sh * 1000))}.`}
                    </p>

                    <Link href="/" className="mt-5 flex items-center justify-center gap-2 h-12 rounded-full border border-border text-15 font-semibold hover:bg-accent">
                        <BusFront className="w-4 h-4" /> Planear mi propio viaje con TransMi
                    </Link>
                </div>
            </div>
        </div>
    );
}
