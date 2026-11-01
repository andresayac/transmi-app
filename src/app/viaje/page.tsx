'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Bell, BellRing, Footprints, LocateFixed, MapPin, Share2, Smartphone, Square, Volume2, VolumeX } from 'lucide-react';
import { ActiveTrip, useAppStore, useHydrated } from '@/stores/app';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useToast } from '@/components/ui/Toast';
import { addMinutes, bogotaNow, formatTime } from '@/lib/schedule';
import RouteBadge from '@/components/transit/RouteBadge';
import ItineraryMap from '@/components/plan/ItineraryMap';
import { useClock } from '@/components/plan/useClock';
import { stopLabel } from '@/components/plan/utils';
import CurrentLeg from '@/components/trip/CurrentLeg';
import ArrivalSummary from '@/components/trip/ArrivalSummary';
import { useDemoPosition } from '@/components/trip/useDemoPosition';
import { useWakeLock } from '@/components/trip/useWakeLock';
import { INITIAL_TRACK, TrackState, advance, buildTripModel, legRemainingM, remainingMinutes, speakableCode } from '@/components/trip/tracking';
import { chime, notificationsState, notify, speak, unlockAudio, vibrate } from '@/components/trip/alerts';
import { prefetchSpeech } from '@/lib/speech';
import { useMyBus } from '@/components/trip/useMyBus';
import ShareTripSheet from '@/components/trip/ShareTripSheet';
import { reportShare, useShareRelay } from '@/components/trip/useShareRelay';
import { useLockAlerts } from '@/components/trip/useLockAlerts';
import LockAlertsCard from '@/components/trip/LockAlertsCard';
import { alertTag } from '@/lib/tripAlerts';
import { cn } from '@/lib/utils';

interface TripViewProps {
    trip: ActiveTrip;
    demo: boolean;
    speed: number;
    finished: boolean;
    onArrived: () => void;
    onEnd: () => void;
}

function TripView({ trip, demo, speed, finished, onArrived, onEnd }: TripViewProps) {
    const router = useRouter();
    const toast = useToast();
    const clock = useClock();
    const settings = useAppStore((s) => s.settings);
    const updateSettings = useAppStore((s) => s.updateSettings);
    const lastLog = useAppStore((s) => s.trips[0] || null);

    const gps = useGeolocation({ watch: true, auto: !demo && !finished });
    const sim = useDemoPosition(demo && !finished ? trip.itinerary : null, speed);
    const pos = demo ? sim : gps;

    const model = useMemo(() => buildTripModel(trip.itinerary, trip.to), [trip]);
    const [track, setTrack] = useState<TrackState>(INITIAL_TRACK);
    const posKey = pos.latitude !== null && pos.longitude !== null ? `${pos.latitude},${pos.longitude}` : '';
    if (posKey && posKey !== track.key && !finished) {
        setTrack(advance(track, { lat: pos.latitude!, lng: pos.longitude! }, model, posKey));
    }

    const [follow, setFollow] = useState(true);
    const [recenterKey, setRecenterKey] = useState(0);
    const [confirmEnd, setConfirmEnd] = useState(false);
    const [notifState, setNotifState] = useState(() => notificationsState());
    const wakeLock = useWakeLock(!finished);

    const legs = trip.itinerary.legs;
    const leg = legs[track.legIndex] || legs[0];
    const nextLeg = legs[track.legIndex + 1] || null;
    const isLastLeg = track.legIndex === legs.length - 1;
    const remainingMin = remainingMinutes(model, track);
    const eta = clock ? addMinutes(bogotaNow(new Date(clock)), remainingMin) : null;
    const etaMs = clock ? clock + remainingMin * 60000 : null;
    const elapsedFrac = model.totalMin ? Math.min(1, Math.max(0, 1 - remainingMin / model.totalMin)) : 0;
    const hasFix = posKey !== '';

    // Ride status, shared by the panel and the announcements
    const rideStops = leg.mode === 'TRANSIT' ? [leg.from, ...(leg.stops || []), leg.to] : [];
    const lastStop = Math.max(0, rideStops.length - 1);
    const passedStop = Math.min(lastStop, Math.floor(track.stopProgress));
    const stopsLeft = leg.mode === 'TRANSIT' ? Math.max(0, lastStop - passedStop) : -1;

    // Which bus is the rider on (lets shared links and the server's alerts follow that bus)
    const here = useMemo(() => (pos.latitude !== null && pos.longitude !== null ? { lat: pos.latitude, lng: pos.longitude } : null), [pos.latitude, pos.longitude]);
    const myBus = useMyBus(leg.mode === 'TRANSIT' && !finished ? leg.line?.code ?? null : null, here);
    const sharedBus = leg.mode === 'TRANSIT' ? myBus?.label ?? null : null;

    // Alerts with TransMi closed: the server follows that bus while the phone is in the background
    const lockAlerts = useLockAlerts(trip, !finished && !demo, { leg: track.legIndex, bus: sharedBus, alarmStops: settings.alarmStops });
    const { given, give, stop: stopLockAlerts } = lockAlerts;

    // Announcements: the instruction once per leg; the wake-up alarm and "get off here" once per
    // leg, given here or by the server's push
    const announced = useRef({ leg: -1 });
    useEffect(() => {
        if (!hasFix || finished) return;
        const a = announced.current;
        const exit = stopLabel(leg.to.name).station;

        if (a.leg !== track.legIndex) {
            a.leg = track.legIndex;
            if (settings.voice && leg.mode === 'TRANSIT') {
                // Synthesize the alarm phrases now so they play instantly when the moment comes
                const alarmWhen = settings.alarmStops === 1 ? 'la próxima parada' : `${settings.alarmStops} paradas`;
                prefetchSpeech(`Prepárate. Te bajas en ${alarmWhen}: ${exit}.`);
                prefetchSpeech(`Bájate aquí: ${exit}.`);
                if (isLastLeg) prefetchSpeech(`Llegaste a ${trip.to.name}.`);
            }
            if (settings.voice) {
                if (leg.mode === 'TRANSIT' && leg.line) {
                    speak(`Toma el ${speakableCode(leg.line.code)}, dirección ${leg.line.longName || leg.line.name}. Te bajas en ${exit}.`);
                } else {
                    speak(isLastLeg ? `Camina hasta ${trip.to.name}.` : `Camina hasta ${stopLabel(leg.to.name).station}.`);
                }
            }
        }

        if (leg.mode !== 'TRANSIT') return;
        const alarmKey = `alarm:${track.legIndex}`;
        const alightKey = `alight:${track.legIndex}`;
        if (stopsLeft > 0 && stopsLeft <= settings.alarmStops && !given(alarmKey)) {
            give(alarmKey);
            const when = stopsLeft === 1 ? 'la próxima parada' : `${stopsLeft} paradas`;
            vibrate();
            chime();
            if (settings.voice) speak(`Prepárate. Te bajas en ${when}: ${exit}.`);
            notify('Prepárate para bajarte', `Te bajas en ${when}: ${exit}`, alertTag('alarm', track.legIndex));
        }
        if (stopsLeft === 0 && !given(alightKey)) {
            give(alightKey);
            vibrate([500, 120, 500]);
            chime();
            if (settings.voice) speak(`Bájate aquí: ${exit}.`);
            notify('Bájate aquí', exit, alertTag('alight', track.legIndex));
        }
    }, [hasFix, finished, track.legIndex, stopsLeft, leg, isLastLeg, trip.to.name, settings.voice, settings.alarmStops, given, give]);

    // Arrival
    const arrivedFired = useRef(false);
    useEffect(() => {
        if (track.arrived && !arrivedFired.current && !finished) {
            arrivedFired.current = true;
            vibrate([300, 100, 300]);
            chime();
            if (settings.voice) speak(`Llegaste a ${trip.to.name}.`);
            stopLockAlerts();
            onArrived();
        }
    }, [track.arrived, finished, onArrived, settings.voice, trip.to.name, stopLockAlerts]);

    const enableAlerts = async () => {
        unlockAudio();
        chime();
        if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
            const result = await Notification.requestPermission().catch(() => 'denied' as NotificationPermission);
            setNotifState(result);
        }
    };

    const share = async () => {
        const text = finished
            ? `Llegué a ${trip.to.name} en TransMilenio.`
            : `Voy en TransMilenio de ${trip.from.name} a ${trip.to.name}. Llego aprox. a las ${eta ? formatTime(eta) : '—'}.`;
        try {
            if (navigator.share) await navigator.share({ title: 'Mi viaje', text });
            else {
                await navigator.clipboard.writeText(text);
                toast.show('Texto copiado', 'success');
            }
        } catch (err) {
            if ((err as Error).name !== 'AbortError') toast.show('No se pudo compartir', 'error');
        }
    };

    const rider = hasFix ? { lat: pos.latitude!, lng: pos.longitude!, heading: pos.heading } : null;
    const [shareOpen, setShareOpen] = useState(false);

    // Shared trip: tell the follower's page about transfers, the bus and the end of the trip
    useShareRelay(trip.share, { leg: track.legIndex, bus: sharedBus, eta: etaMs, ended: finished });
    const endTrip = () => {
        if (trip.share) reportShare(trip.share.id, { key: trip.share.key, leg: track.legIndex, bus: null, eta: null, ended: true }, true);
        stopLockAlerts();
        onEnd();
    };

    return (
        <div className="fixed inset-0 z-40 bg-background flex flex-col max-w-lg mx-auto">
            <div className="relative h-[45dvh] shrink-0">
                <ItineraryMap
                    itinerary={trip.itinerary}
                    from={trip.from}
                    to={trip.to}
                    rider={rider}
                    follow={follow && !!rider && !finished}
                    onUserMove={() => setFollow(false)}
                    recenterKey={recenterKey}
                    padding={{ top: 80, bottom: 40, left: 40, right: 40 }}
                />
                <div className="absolute left-3 right-3 top-[max(env(safe-area-inset-top),12px)] flex items-start justify-between gap-2 pointer-events-none">
                    <button
                        type="button"
                        onClick={() => router.push('/')}
                        className="pointer-events-auto w-11 h-11 rounded-full glass flex items-center justify-center shadow-lg active:scale-95"
                        aria-label="Salir al inicio (el viaje sigue activo)"
                    >
                        <ArrowLeft className="w-5 h-5 text-foreground" />
                    </button>
                    <div className="flex flex-col items-end gap-1.5">
                        {demo && <span className="pointer-events-auto glass rounded-full px-3 py-1 text-12 font-semibold text-foreground">Simulación ×{speed}</span>}
                        {wakeLock && (
                            <span className="glass rounded-full px-3 py-1 text-12 font-medium text-foreground inline-flex items-center gap-1.5">
                                <Smartphone className="w-3.5 h-3.5" /> Pantalla activa
                            </span>
                        )}
                    </div>
                </div>
                {!follow && rider && !finished && (
                    <button
                        type="button"
                        onClick={() => { setFollow(true); setRecenterKey((k) => k + 1); }}
                        className="absolute right-3 bottom-7 w-11 h-11 rounded-full glass flex items-center justify-center shadow-lg active:scale-95"
                        aria-label="Centrar en mi posición"
                    >
                        <LocateFixed className="w-5 h-5 text-foreground" />
                    </button>
                )}
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain -mt-4 relative rounded-t-[22px] bg-background border-t border-border">
                <div className="px-5 pt-5 pb-[max(env(safe-area-inset-bottom),20px)]">
                    {finished ? (
                        <ArrivalSummary trip={trip} log={lastLog && lastLog.to === trip.to.name ? lastLog : null} onShare={share} onDone={() => router.push('/')} />
                    ) : (
                        <>
                            <div className="flex items-end justify-between">
                                <div>
                                    <p className="text-13 text-muted-foreground">Llegada estimada</p>
                                    <p className="font-signage tabular text-30 font-bold leading-none">{eta ? formatTime(eta) : '—'}</p>
                                </div>
                                <p className="font-signage tabular text-30 font-bold leading-none">
                                    {remainingMin}<span className="text-18 font-semibold ml-1">min</span>
                                </p>
                            </div>
                            <div className="mt-3 h-1.5 rounded-full bg-secondary overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(elapsedFrac * 100)} aria-label="Avance del viaje">
                                <div className="h-full bg-foreground rounded-full transition-[width] duration-1000" style={{ width: `${elapsedFrac * 100}%` }} />
                            </div>
                            {myBus && (
                                <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-secondary pl-2.5 pr-3 h-8 text-13 font-medium">
                                    <span className="live-dot" /> Vas en el bus {myBus.label}
                                </p>
                            )}

                            {!hasFix && (
                                <div className="mt-5 rounded-2xl border border-border p-4">
                                    {gps.error && !demo ? (
                                        <>
                                            <p className="text-15 font-semibold">{gps.error}</p>
                                            <p className="mt-1 text-13 text-muted-foreground">Sin tu ubicación no podemos avisarte cuándo bajarte.</p>
                                            <div className="mt-3 flex flex-wrap gap-2">
                                                <button type="button" onClick={gps.requestLocation} className="h-9 px-4 rounded-full bg-foreground text-background text-13 font-semibold">Reintentar</button>
                                                <button type="button" onClick={() => router.replace('/viaje?demo=1')} className="h-9 px-4 rounded-full bg-secondary text-13 font-semibold">Ver simulación</button>
                                            </div>
                                        </>
                                    ) : (
                                        <p className="text-14 text-muted-foreground">Buscando tu ubicación…</p>
                                    )}
                                </div>
                            )}

                            <div className="mt-5">
                                <CurrentLeg
                                    leg={leg}
                                    nextLeg={nextLeg}
                                    isLastLeg={isLastLeg}
                                    remainingM={hasFix ? legRemainingM(model, track) : leg.distanceM}
                                    stopProgress={track.stopProgress}
                                    alarmStops={settings.alarmStops}
                                />
                            </div>

                            {legs.length > track.legIndex + 1 && (
                                <div className="mt-6">
                                    <h2 className="text-13 font-semibold text-muted-foreground mb-1">Después</h2>
                                    <ol>
                                        {legs.slice(track.legIndex + 1).map((l, i) => (
                                            <li key={i} className="flex items-center gap-3 py-2.5 border-b border-border last:border-0">
                                                {l.mode === 'TRANSIT' && l.line ? (
                                                    <RouteBadge code={l.line.code} color={l.line.color} size="sm" />
                                                ) : (
                                                    <span className="w-9 flex justify-center"><Footprints className="w-4 h-4 text-muted-foreground" /></span>
                                                )}
                                                <span className="flex-1 min-w-0 truncate text-14">
                                                    {l.mode === 'TRANSIT' ? `Hasta ${stopLabel(l.to.name).station}` : `Camina hasta ${track.legIndex + 1 + i === legs.length - 1 ? 'tu destino' : stopLabel(l.to.name).station}`}
                                                </span>
                                                <span className="text-13 text-muted-foreground tabular">{l.durationMin} min</span>
                                            </li>
                                        ))}
                                    </ol>
                                </div>
                            )}

                            <div className="mt-6 flex flex-wrap items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => { unlockAudio(); updateSettings({ voice: !settings.voice }); }}
                                    className="h-11 px-4 rounded-full bg-secondary inline-flex items-center gap-2 text-14 font-semibold active:scale-95"
                                    aria-pressed={settings.voice}
                                >
                                    {settings.voice ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                                    {settings.voice ? 'Voz activa' : 'Voz apagada'}
                                </button>
                                <div className="h-11 pl-3 pr-1 rounded-full bg-secondary inline-flex items-center gap-1" role="radiogroup" aria-label="Avisarme antes de bajar">
                                    <BellRing className="w-4 h-4 mr-1" />
                                    {[1, 2, 3].map((n) => (
                                        <button
                                            key={n}
                                            type="button"
                                            role="radio"
                                            aria-checked={settings.alarmStops === n}
                                            aria-label={n === 1 ? 'Avisar 1 parada antes' : `Avisar ${n} paradas antes`}
                                            onClick={() => { unlockAudio(); updateSettings({ alarmStops: n }); }}
                                            className={cn('w-9 h-9 rounded-full text-14 font-bold tabular', settings.alarmStops === n ? 'bg-foreground text-background' : 'text-muted-foreground')}
                                        >
                                            {n}
                                        </button>
                                    ))}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShareOpen(true)}
                                    className="h-11 px-4 rounded-full bg-foreground text-background inline-flex items-center gap-2 text-14 font-semibold active:scale-95"
                                >
                                    <Share2 className="w-4 h-4" /> Compartir
                                </button>
                            </div>
                            <p className="mt-2 text-12 text-muted-foreground">
                                Te avisamos {settings.alarmStops === 1 ? '1 parada' : `${settings.alarmStops} paradas`} antes de bajarte, con vibración{settings.voice ? ', sonido y voz' : ' y sonido'}.
                            </p>

                            {!demo && lockAlerts.hasRides && lockAlerts.status !== 'unsupported' ? (
                                <LockAlertsCard
                                    status={lockAlerts.status}
                                    riding={leg.mode === 'TRANSIT'}
                                    busLabel={sharedBus}
                                    onEnable={() => {
                                        unlockAudio();
                                        void lockAlerts.enable().then(() => setNotifState(notificationsState()));
                                    }}
                                    onRetry={lockAlerts.retry}
                                />
                            ) : notifState === 'default' && (
                                <button type="button" onClick={enableAlerts} className="mt-3 w-full h-11 rounded-full border border-border inline-flex items-center justify-center gap-2 text-14 font-semibold active:scale-[0.99]">
                                    <Bell className="w-4 h-4" /> Activar avisos con la pantalla bloqueada
                                </button>
                            )}

                            {confirmEnd ? (
                                <div className="mt-4 rounded-2xl border border-border p-4">
                                    <p className="text-15 font-semibold">¿Terminar el viaje?</p>
                                    <p className="text-13 text-muted-foreground">Dejaremos de seguir tu ubicación y de avisarte.</p>
                                    <div className="mt-3 flex gap-2">
                                        <button type="button" onClick={endTrip} className="h-10 px-4 rounded-full bg-foreground text-background text-14 font-semibold">Sí, terminar</button>
                                        <button type="button" onClick={() => setConfirmEnd(false)} className="h-10 px-4 rounded-full bg-secondary text-14 font-semibold">Seguir</button>
                                    </div>
                                </div>
                            ) : (
                                <button type="button" onClick={() => setConfirmEnd(true)} className="mt-4 w-full h-11 rounded-full text-14 font-semibold text-destructive inline-flex items-center justify-center gap-2 hover:bg-destructive/10">
                                    <Square className="w-4 h-4" /> Terminar viaje
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>

            {shareOpen && !finished && (
                <ShareTripSheet trip={trip} currentLeg={track.legIndex} eta={eta} etaMs={etaMs} bus={myBus} onClose={() => setShareOpen(false)} />
            )}
        </div>
    );
}

function Trip() {
    const router = useRouter();
    const q = useSearchParams();
    const hydrated = useHydrated();
    const activeTrip = useAppStore((s) => s.activeTrip);
    const endTrip = useAppStore((s) => s.endTrip);
    const [finishedTrip, setFinishedTrip] = useState<ActiveTrip | null>(null);

    const demo = q.get('demo') === '1';
    const speed = Math.min(200, Math.max(1, Number(q.get('speed')) || 20));
    const trip = activeTrip ?? finishedTrip;

    if (!hydrated) {
        return (
            <div className="fixed inset-0 flex flex-col max-w-lg mx-auto">
                <div className="h-[45dvh] skeleton rounded-none" />
                <div className="p-5 space-y-3">
                    <div className="h-8 w-40 rounded skeleton" />
                    <div className="h-24 rounded-2xl skeleton" />
                </div>
            </div>
        );
    }

    if (!trip) {
        return (
            <div className="min-h-dvh flex flex-col items-center justify-center px-8 text-center">
                <MapPin className="w-10 h-10 mb-4" />
                <h1 className="font-signage text-30 font-bold leading-tight">No tienes un viaje en curso</h1>
                <p className="mt-2 text-15 text-muted-foreground max-w-xs">
                    Planea una ruta y toca “Iniciar viaje”: te guiamos parada por parada y te avisamos antes de bajarte.
                </p>
                <Link href="/planear" className="mt-6 h-12 px-6 rounded-full bg-foreground text-background font-signage text-20 font-bold inline-flex items-center">
                    Planear un viaje
                </Link>
                <Link href="/" className="mt-3 text-14 font-semibold text-muted-foreground">Volver al inicio</Link>
            </div>
        );
    }

    return (
        <TripView
            key={trip.startedAt}
            trip={trip}
            demo={demo}
            speed={speed}
            finished={!activeTrip && !!finishedTrip}
            onArrived={() => {
                if (!activeTrip) return;
                setFinishedTrip(activeTrip);
                // Simulated trips don't count towards "Tu movilidad"
                endTrip(!demo);
            }}
            onEnd={() => {
                endTrip(false);
                router.push('/');
            }}
        />
    );
}

export default function ViajePage() {
    return (
        <Suspense fallback={null}>
            <Trip />
        </Suspense>
    );
}
