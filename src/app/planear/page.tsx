'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowDownUp, ArrowLeft, Briefcase, Clock3, House, MapPin, RefreshCw, X } from 'lucide-react';
import type { PlanPlace, PlanResponse } from '@/types/transit';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useAppStore, useHydrated } from '@/stores/app';
import { bogotaNow } from '@/lib/schedule';
import SystemStripe from '@/components/brand/SystemStripe';
import PlaceSuggestions from '@/components/plan/PlaceSuggestions';
import DeparturePicker from '@/components/plan/DeparturePicker';
import ItineraryCard, { ItineraryCardSkeleton } from '@/components/plan/ItineraryCard';
import ItineraryDetail from '@/components/plan/ItineraryDetail';
import { useClock } from '@/components/plan/useClock';
import { Departure, departureDate, hm, placeFromParams, placeParams, plannerUrl, samePlace, ymd } from '@/components/plan/utils';
import { cn } from '@/lib/utils';

type FromChoice = PlanPlace | 'gps';

interface Results {
    key: string;
    data?: PlanResponse;
    error?: string;
}

function initialDeparture(q: URLSearchParams): Departure {
    const date = q.get('date') || '';
    const time = q.get('time') || '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(date) && /^\d{2}:\d{2}/.test(time)) return { mode: 'at', date, time: time.slice(0, 5) };
    return { mode: 'now', date: '', time: '' };
}

function FieldButton({ label, place, placeholder, marker, onClick, onClear }: {
    label: string;
    place: PlanPlace | null;
    placeholder: string;
    marker: React.ReactNode;
    onClick: () => void;
    onClear?: () => void;
}) {
    return (
        <div className="flex items-center gap-3 min-h-[52px]">
            <span className="w-5 flex justify-center shrink-0">{marker}</span>
            <button type="button" onClick={onClick} className="flex-1 min-w-0 text-left py-1.5" aria-label={`${label}: ${place?.name || placeholder}`}>
                <span className="block text-[12px] text-muted-foreground">{label}</span>
                <span className={cn('block truncate text-[16px] font-semibold', place ? 'text-foreground' : 'text-muted-foreground')}>
                    {place?.name || placeholder}
                </span>
            </button>
            {place && onClear && (
                <button type="button" onClick={onClear} className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-accent" aria-label={`Borrar ${label.toLowerCase()}`}>
                    <X className="w-4 h-4" />
                </button>
            )}
        </div>
    );
}

function Planner() {
    const router = useRouter();
    const q = useSearchParams();
    const hydrated = useHydrated();
    const clock = useClock();
    const gps = useGeolocation();
    const home = useAppStore((s) => s.home);
    const work = useAppStore((s) => s.work);
    const recent = useAppStore((s) => s.recentPlaces);
    const startTrip = useAppStore((s) => s.startTrip);
    const pushRecentPlace = useAppStore((s) => s.pushRecentPlace);

    const [fromChoice, setFromChoice] = useState<FromChoice>(() => placeFromParams(q, 'from') ?? 'gps');
    const [to, setTo] = useState<PlanPlace | null>(() => placeFromParams(q, 'to'));
    const [departure, setDeparture] = useState<Departure>(() => initialDeparture(q));
    const [editing, setEditing] = useState<'from' | 'to' | null>(null);
    const [results, setResults] = useState<Results>({ key: '' });
    const [nonce, setNonce] = useState(0);
    const [gpsName, setGpsName] = useState<{ key: string; name: string } | null>(null);
    const openedDetail = useRef(false);

    // Deep links that arrive while the planner is already open (e.g. from the assistant)
    const urlKey = ['toLat', 'toLng', 'fromLat', 'fromLng'].map((k) => q.get(k) || '').join(',');
    const [seenUrlKey, setSeenUrlKey] = useState(urlKey);
    if (urlKey !== seenUrlKey) {
        setSeenUrlKey(urlKey);
        const t = placeFromParams(q, 'to');
        if (t && !samePlace(t, to)) setTo(t);
        const f = placeFromParams(q, 'from');
        if (f && (fromChoice === 'gps' || !samePlace(f, fromChoice))) setFromChoice(f);
    }

    const gpsLat = gps.latitude, gpsLng = gps.longitude;
    const gpsPoint = useMemo(() => (gpsLat !== null && gpsLng !== null ? { lat: gpsLat, lng: gpsLng } : null), [gpsLat, gpsLng]);
    const gpsKey = gpsPoint ? `${gpsPoint.lat.toFixed(4)},${gpsPoint.lng.toFixed(4)}` : '';

    // Readable name for "Mi ubicación"
    useEffect(() => {
        if (!gpsKey) return;
        const ctrl = new AbortController();
        const [lat, lng] = gpsKey.split(',');
        fetch(`/api/geocode/reverse?lat=${lat}&lng=${lng}`, { signal: ctrl.signal })
            .then((r) => (r.ok ? r.json() : null))
            .then((p: PlanPlace | null) => p?.name && setGpsName({ key: gpsKey, name: [p.name, p.detail].filter(Boolean).join(', ') }))
            .catch(() => { /* the coordinates are enough */ });
        return () => ctrl.abort();
    }, [gpsKey]);

    const gpsDetail = gpsName?.key === gpsKey ? gpsName.name : undefined;
    const from: PlanPlace | null = useMemo(() => {
        if (fromChoice !== 'gps') return fromChoice;
        return gpsPoint ? { name: 'Mi ubicación', detail: gpsDetail, lat: gpsPoint.lat, lng: gpsPoint.lng, kind: 'gps' } : null;
    }, [fromChoice, gpsPoint, gpsDetail]);

    const samePoints = from && to ? samePlace(from, to) : false;
    const depKey = departure.mode === 'at' ? `${departure.date}T${departure.time}` : 'now';
    const searchKey = from && to && !samePoints
        ? `${from.lat.toFixed(5)},${from.lng.toFixed(5)}|${to.lat.toFixed(5)},${to.lng.toFixed(5)}|${depKey}|${nonce}`
        : null;

    // Plan whenever origin, destination or departure change
    const fromRef = useRef(from);
    const toRef = useRef(to);
    const depRef = useRef(departure);
    useEffect(() => {
        fromRef.current = from;
        toRef.current = to;
        depRef.current = departure;
    });

    useEffect(() => {
        if (!searchKey) return;
        const f = fromRef.current!, t = toRef.current!, dep = depRef.current;
        const ctrl = new AbortController();
        const params = new URLSearchParams({ ...placeParams('from', f), ...placeParams('to', t) });
        if (dep.mode === 'at') {
            params.set('date', dep.date);
            params.set('time', `${dep.time}:00`);
        }
        fetch(`/api/plan?${params.toString()}`, { signal: ctrl.signal })
            .then(async (r) => {
                const json = await r.json();
                if (!r.ok) throw new Error(json?.error || 'plan');
                setResults({ key: searchKey, data: json as PlanResponse });
            })
            .catch((err) => {
                if ((err as Error).name === 'AbortError') return;
                setResults({ key: searchKey, error: 'No pudimos planear el viaje. Revisa tu conexión e intenta de nuevo.' });
            });

        // Keep the URL shareable and back/forward friendly
        const extra: Record<string, string> = dep.mode === 'at' ? { date: dep.date, time: dep.time } : {};
        const target = plannerUrl(f, t, extra);
        if (`${window.location.pathname}${window.location.search}` !== target && !new URLSearchParams(window.location.search).get('it')) {
            router.replace(target, { scroll: false });
        }
        return () => ctrl.abort();
    }, [searchKey, router]);

    const current = searchKey && results.key === searchKey ? results : null;
    const loading = !!searchKey && !current;
    const itineraries = current?.data?.itineraries || [];

    const nowWall = clock ? bogotaNow(new Date(clock)) : null;
    const departAt = nowWall ? departureDate(departure, nowWall) : null;
    const live = departure.mode === 'now';
    const selectedId = q.get('it');
    const selected = selectedId ? itineraries.find((i) => i.id === selectedId) || null : null;

    const pickPlace = (place: PlanPlace) => {
        if (editing === 'from') {
            setFromChoice(place.kind === 'gps' ? 'gps' : place);
        } else {
            setTo(place);
            pushRecentPlace(place);
        }
        setEditing(null);
    };

    const swap = () => {
        const nextFrom: FromChoice = to ? (to.kind === 'gps' ? 'gps' : to) : 'gps';
        setTo(from);
        setFromChoice(nextFrom);
    };

    const openDetail = (id: string) => {
        openedDetail.current = true;
        const params = new URLSearchParams(window.location.search);
        params.set('it', id);
        router.push(`/planear?${params.toString()}`, { scroll: false });
    };

    const closeDetail = () => {
        if (openedDetail.current) {
            openedDetail.current = false;
            router.back();
            return;
        }
        const params = new URLSearchParams(window.location.search);
        params.delete('it');
        router.replace(`/planear?${params.toString()}`, { scroll: false });
    };

    const start = () => {
        if (!selected || !from || !to) return;
        if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
            Notification.requestPermission().catch(() => { /* optional */ });
        }
        startTrip({ itinerary: selected, from, to });
        pushRecentPlace(to);
        router.push('/viaje');
    };

    const goBack = () => {
        if (window.history.length > 1) router.back();
        else router.push('/');
    };

    const today = nowWall ? ymd(nowWall) : '';
    const nowTime = nowWall ? hm(nowWall) : '';

    return (
        <div className="min-h-dvh pb-[max(env(safe-area-inset-bottom),24px)]">
            <header className="sticky top-0 z-30 bg-background/92 backdrop-blur-xl">
                <div className="flex items-center gap-2 px-3 h-14 pt-[env(safe-area-inset-top)]">
                    <button type="button" onClick={goBack} className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-accent active:scale-95" aria-label="Volver">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <h1 className="font-signage text-[24px] font-bold">¿A dónde vas?</h1>
                </div>
                <SystemStripe />
            </header>

            <section className="px-4 pt-4">
                <div className="relative rounded-2xl border border-border bg-card px-3 py-1">
                    <FieldButton
                        label="Desde"
                        place={from}
                        placeholder={gps.loading ? 'Buscando tu ubicación…' : 'Elige el punto de partida'}
                        marker={<span className="w-3.5 h-3.5 rounded-full border-[3.5px] border-foreground bg-background" />}
                        onClick={() => setEditing('from')}
                    />
                    <div className="ml-8 mr-12 border-t border-border" />
                    <FieldButton
                        label="Hasta"
                        place={to}
                        placeholder="Busca un lugar o estación"
                        marker={<span className="w-3.5 h-3.5 rounded-[3px] bg-foreground" />}
                        onClick={() => setEditing('to')}
                        onClear={() => setTo(null)}
                    />
                    <span aria-hidden className="absolute left-[21px] top-[38px] h-[30px] border-l-2 border-dotted border-muted-foreground/60" />
                    <button
                        type="button"
                        onClick={swap}
                        disabled={!from && !to}
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-secondary flex items-center justify-center active:scale-95 disabled:opacity-40"
                        aria-label="Intercambiar origen y destino"
                    >
                        <ArrowDownUp className="w-[18px] h-[18px]" />
                    </button>
                </div>

                {fromChoice === 'gps' && gps.error && !gpsPoint && (
                    <p className="mt-2 text-[13px] text-muted-foreground">
                        {gps.error}. <button type="button" onClick={gps.requestLocation} className="font-semibold text-foreground underline underline-offset-2">Reintentar</button> o elige el origen a mano.
                    </p>
                )}

                <div className="mt-3">
                    <DeparturePicker value={departure} today={today} nowTime={nowTime} onChange={setDeparture} />
                </div>
            </section>

            {/* Before a destination is chosen: quick picks */}
            {!to && (
                <section className="px-4 pt-6">
                    {hydrated && (home || work) && (
                        <div className="flex gap-2 mb-5">
                            {home && (
                                <button type="button" onClick={() => setTo(home)} className="flex-1 flex items-center gap-2.5 rounded-2xl border border-border p-3 active:scale-[0.98]">
                                    <House className="w-5 h-5" /><span className="font-semibold text-[15px]">Casa</span>
                                </button>
                            )}
                            {work && (
                                <button type="button" onClick={() => setTo(work)} className="flex-1 flex items-center gap-2.5 rounded-2xl border border-border p-3 active:scale-[0.98]">
                                    <Briefcase className="w-5 h-5" /><span className="font-semibold text-[15px]">Trabajo</span>
                                </button>
                            )}
                        </div>
                    )}
                    {hydrated && recent.length > 0 ? (
                        <>
                            <h2 className="text-[14px] font-semibold text-muted-foreground mb-1">Viajes recientes</h2>
                            <ul>
                                {recent.map((p, i) => (
                                    <li key={`${p.lat},${p.lng},${i}`}>
                                        <button type="button" onClick={() => setTo(p)} className="w-full flex items-center gap-3 py-3 text-left border-b border-border last:border-0">
                                            <Clock3 className="w-4 h-4 text-muted-foreground shrink-0" />
                                            <span className="min-w-0">
                                                <span className="block truncate text-[15px] font-medium">{p.name}</span>
                                                {p.detail && <span className="block truncate text-[12px] text-muted-foreground">{p.detail}</span>}
                                            </span>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </>
                    ) : (
                        <button type="button" onClick={() => setEditing('to')} className="w-full rounded-2xl border border-dashed border-border p-5 text-left active:scale-[0.99]">
                            <MapPin className="w-5 h-5 mb-2" />
                            <p className="font-signage text-[20px] font-bold">Escribe tu destino</p>
                            <p className="text-[13px] text-muted-foreground mt-0.5">Una dirección, un lugar como “Movistar Arena” o una estación.</p>
                        </button>
                    )}
                </section>
            )}

            {to && (
                <section className="px-4 pt-5 space-y-3" aria-live="polite" aria-busy={loading}>
                    {samePoints && <p className="text-[14px] text-muted-foreground">El origen y el destino son el mismo lugar. Cambia uno de los dos.</p>}
                    {!from && !samePoints && (
                        <p className="text-[14px] text-muted-foreground">
                            Elige desde dónde sales para ver las rutas. <button type="button" onClick={() => setEditing('from')} className="font-semibold text-foreground underline underline-offset-2">Elegir origen</button>
                        </p>
                    )}

                    {loading && (
                        <>
                            <p className="text-[13px] text-muted-foreground">Buscando las mejores opciones…</p>
                            <ItineraryCardSkeleton />
                            <ItineraryCardSkeleton />
                            <ItineraryCardSkeleton />
                        </>
                    )}

                    {current?.error && (
                        <div className="rounded-2xl border border-border p-5">
                            <p className="text-[15px] font-semibold">{current.error}</p>
                            <button type="button" onClick={() => setNonce((n) => n + 1)} className="mt-3 inline-flex items-center gap-2 h-10 px-4 rounded-full bg-foreground text-background text-[14px] font-semibold">
                                <RefreshCw className="w-4 h-4" /> Reintentar
                            </button>
                        </div>
                    )}

                    {current?.data && itineraries.length === 0 && (
                        <div className="rounded-2xl border border-border p-5">
                            <p className="font-signage text-[20px] font-bold">No encontramos rutas</p>
                            <p className="mt-1 text-[14px] text-muted-foreground">
                                {departure.mode === 'at'
                                    ? 'A esa hora puede que el sistema no esté operando. Prueba con otra hora.'
                                    : 'Prueba con un origen o destino más cerca de una estación, o con otra hora de salida.'}
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2">
                                {departure.mode === 'at' && (
                                    <button type="button" onClick={() => setDeparture({ ...departure, mode: 'now' })} className="h-9 px-4 rounded-full bg-foreground text-background text-[13px] font-semibold">Salir ahora</button>
                                )}
                                <button type="button" onClick={() => setEditing('from')} className="h-9 px-4 rounded-full bg-secondary text-[13px] font-semibold">Cambiar origen</button>
                            </div>
                        </div>
                    )}

                    {itineraries.length > 0 && (
                        <>
                            <div className="flex items-center justify-between">
                                <p className="text-[13px] text-muted-foreground">
                                    {itineraries.length === 1 ? '1 opción' : `${itineraries.length} opciones`}
                                </p>
                                <button type="button" onClick={() => setNonce((n) => n + 1)} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-foreground" aria-label="Actualizar opciones">
                                    <RefreshCw className="w-3.5 h-3.5" /> Actualizar
                                </button>
                            </div>
                            {itineraries.map((it) => (
                                <ItineraryCard key={it.id} itinerary={it} departAt={departAt} live={live} onSelect={() => openDetail(it.id)} />
                            ))}
                        </>
                    )}
                </section>
            )}

            {editing && (
                <PlaceSuggestions
                    field={editing}
                    initialQuery={editing === 'to' && to && to.kind !== 'gps' ? to.name : ''}
                    gps={gpsPoint}
                    gpsError={gps.error}
                    onRequestGps={gps.requestLocation}
                    onPick={pickPlace}
                    onClose={() => setEditing(null)}
                />
            )}

            {selected && from && to && (
                <ItineraryDetail
                    itinerary={selected}
                    from={from}
                    to={to}
                    departAt={departAt}
                    live={live}
                    onBack={closeDetail}
                    onStart={start}
                />
            )}
        </div>
    );
}

export default function PlanearPage() {
    return (
        <Suspense fallback={<PlannerFallback />}>
            <Planner />
        </Suspense>
    );
}

function PlannerFallback() {
    return (
        <div className="px-4 pt-20 space-y-3">
            <div className="h-28 rounded-2xl skeleton" />
            <ItineraryCardSkeleton />
            <ItineraryCardSkeleton />
        </div>
    );
}
