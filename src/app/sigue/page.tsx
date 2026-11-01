'use client';

import { useMemo, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { BusFront, Check, Clock, Footprints, MapPin, ShieldCheck } from 'lucide-react';
import ItineraryMap from '@/components/plan/ItineraryMap';
import RouteBadge from '@/components/transit/RouteBadge';
import SystemStripe from '@/components/brand/SystemStripe';
import { useClock } from '@/components/plan/useClock';
import { stopLabel } from '@/components/plan/utils';
import { useLiveData } from '@/hooks/useLiveData';
import { decodePolyline, toItinerary, unpackTrip, type SharedTrip } from '@/lib/tripShare';
import { haversine, projectOnPath, type LngLat } from '@/lib/geo';
import { formatTime } from '@/lib/schedule';
import type { LiveBus } from '@/types/transit';
import { cn } from '@/lib/utils';

/** Links stop being "live" after this long */
const EXPIRES_MS = 6 * 60 * 60 * 1000;

function subscribeHash(onChange: () => void) {
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
}

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

function FollowView({ trip }: { trip: SharedTrip }) {
    const now = useClock();
    const { itinerary, from, to } = useMemo(() => toItinerary(trip), [trip]);
    const legs = trip.legs;
    const sharedLeg = legs[trip.cur];
    const expired = now - trip.sh * 1000 > EXPIRES_MS;

    // Live position of the sender's bus (when the link carries one)
    const busLeg = sharedLeg?.m === 'T' && trip.bus ? sharedLeg : null;
    const { data, updatedAt } = useLiveData<{ buses: LiveBus[] }>(busLeg && !expired ? `/api/live?ruta=${encodeURIComponent(busLeg.c || '')}` : null, 10000);
    const bus = busLeg ? data?.buses.find((b) => b.label === trip.bus) || null : null;

    // Remember when the bus reached the stop where the sender gets off
    const [alightedAt, setAlightedAt] = useState<number | null>(null);
    const geometry = useMemo(() => (busLeg ? decodePolyline(busLeg.g) : []), [busLeg]);
    const progress = bus && geometry.length ? fractionAlong(geometry, bus) : null;
    const onRoute = progress && progress.offsetM < 500;
    if (progress && onRoute && progress.fraction > 0.97 && alightedAt === null) setAlightedAt(now);

    const restAfter = (legIndex: number) => legs.slice(legIndex + 1).reduce((s, l) => s + l.d, 0);

    // Best estimate of the arrival time
    let etaMs = trip.eta * 1000;
    let mode: 'live' | 'estimate' = 'estimate';
    let currentLeg = trip.cur;
    if (busLeg && alightedAt !== null) {
        etaMs = alightedAt + restAfter(trip.cur) * 60000;
        currentLeg = Math.min(legs.length - 1, trip.cur + 1);
    } else if (busLeg && progress && onRoute) {
        etaMs = now + ((1 - progress.fraction) * busLeg.d + restAfter(trip.cur)) * 60000;
        mode = 'live';
    } else {
        // No live bus: walk the plan forward in time from when the link was shared
        let t = trip.sh * 1000;
        for (let i = trip.cur; i < legs.length; i++) {
            currentLeg = i;
            t += legs[i].d * 60000;
            if (t > now) break;
        }
    }

    const minutesLeft = Math.max(0, Math.round((etaMs - now) / 60000));
    const overdue = now > etaMs + 20 * 60000;
    const arrivedProbably = overdue || (minutesLeft === 0 && mode === 'estimate');
    const who = trip.by || 'Tu contacto';
    const leg = legs[currentLeg];
    const rider = bus && onRoute ? { lat: bus.lat, lng: bus.lng, heading: bus.bearing } : null;
    const secondsAgo = updatedAt ? Math.max(0, Math.round((now - updatedAt) / 1000)) : null;

    return (
        <div className="fixed inset-0 z-40 bg-background flex flex-col max-w-lg mx-auto">
            <div className="relative h-[48dvh] shrink-0">
                <ItineraryMap itinerary={itinerary} from={from} to={to} rider={rider} follow={!!rider} padding={{ top: 70, bottom: 40, left: 40, right: 40 }} />
                <div className="absolute left-3 right-3 top-[max(env(safe-area-inset-top),12px)] flex justify-between pointer-events-none">
                    <span className="glass rounded-full px-3 py-1.5 text-13 font-semibold text-foreground inline-flex items-center gap-2">
                        {mode === 'live' && !expired ? <><span className="live-dot" /> Bus en vivo</> : <><Clock className="w-3.5 h-3.5" /> Estimado</>}
                    </span>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto -mt-4 relative rounded-t-[22px] bg-background border-t border-border">
                <SystemStripe className="rounded-t-[22px]" />
                <div className="px-5 pt-5 pb-[max(env(safe-area-inset-bottom),24px)]">
                    <p className="text-14 text-muted-foreground">{expired ? `${who} viajó hacia` : `${who} va hacia`}</p>
                    <h1 className="font-signage text-32 font-bold leading-tight">{name(trip.to[0])}</h1>

                    {expired ? (
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
                                                {mode === 'live' ? `En el bus ${trip.bus}` : 'En bus'} hacia {leg.n}
                                            </p>
                                            <p className="text-13 text-muted-foreground">
                                                Se baja en {name(leg.t[0])}
                                                {mode === 'live' && secondsAgo !== null && ` · posición de hace ${secondsAgo < 60 ? `${secondsAgo} s` : `${Math.round(secondsAgo / 60)} min`}`}
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="flex items-center gap-3 text-15 font-semibold">
                                        <Footprints className="w-5 h-5" /> Caminando hacia {currentLeg === legs.length - 1 ? 'su destino' : name(leg?.t[0] || '')}
                                    </p>
                                )}
                                {trip.bus && busLeg && !bus && data && (
                                    <p className="mt-2 text-12 text-muted-foreground">El bus {trip.bus} no está reportando posición ahora: mostramos la hora estimada.</p>
                                )}
                            </div>
                        </>
                    )}

                    <ol className="mt-5">
                        {legs.map((l, i) => {
                            const done = i < currentLeg || (expired && true);
                            const current = i === currentLeg && !expired;
                            return (
                                <li key={i} className={cn('flex items-center gap-3 py-2.5 border-b border-border last:border-0', done && 'opacity-45')}>
                                    <span className="w-10 flex justify-center shrink-0">
                                        {done ? <Check className="w-4 h-4" /> : l.m === 'T' && l.c ? <RouteBadge code={l.c} color={l.k} size="xs" /> : <Footprints className="w-4 h-4 text-muted-foreground" />}
                                    </span>
                                    <span className={cn('flex-1 min-w-0 truncate text-14', current && 'font-semibold')}>
                                        {l.m === 'T' ? `${name(l.f[0])} → ${name(l.t[0])}` : i === legs.length - 1 ? `Camina hasta ${name(trip.to[0])}` : `Camina hasta ${name(l.t[0])}`}
                                    </span>
                                    <span className="text-13 text-muted-foreground tabular shrink-0">{l.d} min</span>
                                </li>
                            );
                        })}
                    </ol>

                    <p className="mt-5 flex items-start gap-1.5 text-12 text-muted-foreground">
                        <ShieldCheck className="w-3.5 h-3.5 mt-px shrink-0" />
                        Seguimos el bus con los datos en vivo de TransMilenio, no el celular de {trip.by || 'quien comparte'}. Compartido a las {formatTime(new Date(trip.sh * 1000))}.
                    </p>

                    <Link href="/" className="mt-5 flex items-center justify-center gap-2 h-12 rounded-full border border-border text-15 font-semibold hover:bg-accent">
                        <BusFront className="w-4 h-4" /> Planear mi propio viaje con TransMi
                    </Link>
                </div>
            </div>
        </div>
    );
}

export default function SiguePage() {
    const hash = useSyncExternalStore(subscribeHash, () => window.location.hash, () => '');
    const trip = useMemo(() => (hash.length > 1 ? unpackTrip(hash.slice(1)) : null), [hash]);

    if (!hash) {
        return <div className="min-h-dvh flex items-center justify-center"><div className="w-40 h-[3px] rounded-full system-stripe" /></div>;
    }

    if (!trip) {
        return (
            <div className="min-h-dvh flex flex-col items-center justify-center px-8 text-center">
                <MapPin className="w-10 h-10 mb-4" />
                <h1 className="font-signage text-28 font-bold leading-tight">Este enlace no se puede leer</h1>
                <p className="mt-2 text-15 text-muted-foreground max-w-xs">Puede que se haya cortado al copiarlo. Pídele a quien te lo envió que lo comparta de nuevo.</p>
                <Link href="/" className="mt-6 h-12 px-6 rounded-full bg-foreground text-background font-signage text-20 font-bold inline-flex items-center">Abrir TransMi</Link>
            </div>
        );
    }

    return <FollowView trip={trip} />;
}
