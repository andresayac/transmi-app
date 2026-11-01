'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    ArrowRight,
    Cloud,
    CloudDrizzle,
    CloudFog,
    CloudLightning,
    CloudRain,
    CloudSun,
    Footprints,
    MapPin,
    Moon,
    Navigation,
    Repeat,
    Sun,
    TrainFront,
} from 'lucide-react';
import type { AssistantCard } from './types';
import type { Itinerary, PlanPlace, ServicePoint, WeatherNow } from '@/types/transit';
import { useAppStore } from '@/stores/app';
import SegmentBar from '@/components/transit/SegmentBar';
import RouteBadge from '@/components/transit/RouteBadge';
import ArrivalBoard from '@/components/transit/ArrivalBoard';
import { formatDistance } from '@/lib/geo';
import { addMinutes, bogotaNow, CONVENTION_LABELS, formatClock, formatTime } from '@/lib/schedule';
import { cn } from '@/lib/utils';

const TAG_LABEL: Record<string, string> = {
    fastest: 'Más rápida',
    'fewest-transfers': 'Menos transbordos',
    'least-walking': 'Menos caminata',
};

const shell = 'rounded-2xl border border-border bg-card overflow-hidden';

function planHref(from: PlanPlace | null, to: PlanPlace) {
    const q = new URLSearchParams({ toLat: String(to.lat), toLng: String(to.lng), toName: to.name });
    if (from) {
        q.set('fromLat', String(from.lat));
        q.set('fromLng', String(from.lng));
        q.set('fromName', from.name);
    }
    return `/planear?${q.toString()}`;
}

function ItineraryRow({ itinerary, from, to }: { itinerary: Itinerary; from: PlanPlace; to: PlanPlace }) {
    const router = useRouter();
    const firstRide = itinerary.legs.find((l) => l.mode === 'TRANSIT');
    const arrival = formatTime(addMinutes(new Date(), itinerary.durationMin));

    const start = () => {
        useAppStore.getState().startTrip({ itinerary, from, to });
        router.push('/viaje');
    };

    return (
        <div className="px-4 py-3.5">
            <div className="flex items-baseline justify-between gap-3">
                <div className="flex items-baseline gap-2">
                    <span className="font-signage text-[30px] font-bold leading-none tabular">{itinerary.durationMin}</span>
                    <span className="font-signage text-[17px] font-semibold text-muted-foreground">min</span>
                </div>
                <span className="text-[13px] text-muted-foreground tabular">Llegas {arrival}</span>
            </div>
            {itinerary.tags.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {itinerary.tags.map((t) => (
                        <span key={t} className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">{TAG_LABEL[t] || t}</span>
                    ))}
                </div>
            )}
            <SegmentBar legs={itinerary.legs} className="mt-3" />
            <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted-foreground">
                <span className="inline-flex items-center gap-1"><Footprints className="h-3.5 w-3.5" />{formatDistance(itinerary.walkMeters)} a pie</span>
                <span className="inline-flex items-center gap-1"><Repeat className="h-3.5 w-3.5" />{itinerary.transfers === 0 ? 'Sin transbordos' : itinerary.transfers === 1 ? '1 transbordo' : `${itinerary.transfers} transbordos`}</span>
            </div>
            {firstRide && (
                <p className="mt-1.5 text-[13px] text-foreground/85">
                    Sube a la <span className="font-semibold">{firstRide.line?.code}</span> en {firstRide.from.name}
                </p>
            )}
            <button
                type="button"
                onClick={start}
                className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-full bg-foreground px-4 text-[13px] font-semibold text-background transition active:scale-95"
            >
                <Navigation className="h-3.5 w-3.5" />
                Iniciar viaje
            </button>
        </div>
    );
}

function ItinerariesCard({ card }: { card: Extract<AssistantCard, { kind: 'itineraries' }> }) {
    return (
        <div className={shell}>
            <div className="flex items-center gap-2 px-4 pt-3.5 pb-1 text-[13px] text-muted-foreground">
                <span className="truncate">{card.from.name}</span>
                <ArrowRight className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate font-medium text-foreground">{card.to.name}</span>
            </div>
            <div className="divide-y divide-border">
                {card.itineraries.map((it) => <ItineraryRow key={it.id} itinerary={it} from={card.from} to={card.to} />)}
            </div>
            <Link
                href={planHref(card.from, card.to)}
                className="flex items-center justify-between border-t border-border px-4 py-3 text-[13px] font-semibold hover:bg-accent"
            >
                Ver detalles en el planeador
                <ArrowRight className="h-4 w-4" />
            </Link>
        </div>
    );
}

function RouteCard({ card }: { card: Extract<AssistantCard, { kind: 'route' }> }) {
    const href = `/mapa?${new URLSearchParams({ id: card.id, nombre: card.nombre, codigo: card.codigo }).toString()}`;
    return (
        <div className={shell}>
            <div className="flex items-start gap-3 px-4 pt-4">
                <RouteBadge code={card.codigo} color={card.color} size="md" inactive={card.activeNow === false} />
                <div className="min-w-0 flex-1">
                    <p className="font-signage text-[19px] font-bold leading-tight">{card.nombre}</p>
                    {card.firstStop && card.lastStop && (
                        <p className="mt-0.5 truncate text-[12px] text-muted-foreground">{card.firstStop} → {card.lastStop}</p>
                    )}
                    <p className="mt-1 flex items-center gap-1.5 text-[12px]">
                        {card.activeNow ? (
                            <><span className="live-dot" /> <span className="text-foreground">Opera ahora</span></>
                        ) : card.activeNow === false ? (
                            <><span className="h-2 w-2 rounded-full bg-muted-foreground" /> <span className="text-muted-foreground">Fuera de horario</span></>
                        ) : (
                            <span className="text-muted-foreground">Horario sin confirmar</span>
                        )}
                        <span className="text-muted-foreground">· {card.stopCount} paradas</span>
                    </p>
                </div>
            </div>
            {card.schedules.length > 0 && (
                <ul className="mx-4 mt-3 space-y-1 rounded-xl bg-secondary px-3 py-2.5 text-[13px]">
                    {card.schedules.map((h, i) => (
                        <li key={i} className="flex justify-between gap-3">
                            <span className="text-muted-foreground">{CONVENTION_LABELS[h.convencion] || h.convencion}</span>
                            <span className="font-medium tabular">{formatClock(h.hora_inicio)} – {formatClock(h.hora_fin)}</span>
                        </li>
                    ))}
                </ul>
            )}
            <Link href={href} className="mt-3 flex items-center justify-between border-t border-border px-4 py-3 text-[13px] font-semibold hover:bg-accent">
                Ver en el mapa con buses en vivo
                <ArrowRight className="h-4 w-4" />
            </Link>
        </div>
    );
}

function todayHours(p: ServicePoint): string {
    const day = bogotaNow().getDay();
    const raw = day === 0 ? p.hours.hol : day === 6 ? p.hours.sat : p.hours.wk;
    return raw?.trim() || '';
}

/** Shop names arrive in ALL CAPS: show them in title case. */
function prettyName(name: string): string {
    if (name.length < 4 || name !== name.toUpperCase()) return name;
    return name.toLowerCase().replace(/(^|\s|-)(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase());
}

function isServicePoint(p: PlanPlace | ServicePoint): p is ServicePoint {
    return 'hours' in p;
}

function PlacesCard({ card }: { card: Extract<AssistantCard, { kind: 'places' }> }) {
    return (
        <div className={shell}>
            <p className="px-4 pt-3.5 pb-1 font-signage text-[18px] font-bold">{card.title}</p>
            <ul className="divide-y divide-border">
                {card.places.map((p, i) => {
                    const sp = isServicePoint(p) ? p : null;
                    const hours = sp ? todayHours(sp) : '';
                    const station = !sp && (p as PlanPlace).kind === 'station';
                    return (
                        <li key={`${p.name}-${i}`} className="flex items-center gap-3 px-4 py-3">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary">
                                {station ? <TrainFront className="h-4 w-4" /> : <MapPin className="h-4 w-4" />}
                            </span>
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-[14px] font-medium">{prettyName(p.name)}</p>
                                <p className="truncate text-[12px] text-muted-foreground">
                                    {sp ? [sp.address, sp.distanceM !== undefined ? formatDistance(sp.distanceM) : ''].filter(Boolean).join(' · ') : (p as PlanPlace).detail}
                                </p>
                                {hours && <p className="text-[12px] text-muted-foreground">Hoy: {hours}</p>}
                            </div>
                            <Link
                                href={planHref(null, { name: p.name, lat: p.lat, lng: p.lng })}
                                className="shrink-0 rounded-full border border-border px-3 py-1.5 text-[12px] font-semibold hover:bg-accent"
                            >
                                Ir hasta aquí
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}

function WeatherIcon({ weather: w, className }: { weather: WeatherNow; className?: string }) {
    const c = w.code;
    const props = { className, strokeWidth: 1.6, 'aria-hidden': true };
    if (c >= 95) return <CloudLightning {...props} />;
    if ([61, 63, 65, 66, 67, 80, 81, 82].includes(c)) return <CloudRain {...props} />;
    if (c >= 51 && c <= 57) return <CloudDrizzle {...props} />;
    if (c === 45 || c === 48) return <CloudFog {...props} />;
    if (c === 3) return <Cloud {...props} />;
    if (c === 1 || c === 2) return w.isDay ? <CloudSun {...props} /> : <Cloud {...props} />;
    return w.isDay ? <Sun {...props} /> : <Moon {...props} />;
}

function WeatherCard({ weather }: { weather: WeatherNow }) {
    const rain = weather.rainInMin === null
        ? 'No se espera lluvia en las próximas 2 horas.'
        : weather.rainInMin === 0
            ? 'Está lloviendo. Lleva sombrilla.'
            : `Podría llover en unos ${weather.rainInMin} minutos.`;
    return (
        <div className={cn(shell, 'flex items-center gap-4 px-4 py-4')}>
            <WeatherIcon weather={weather} className="h-10 w-10 shrink-0" />
            <div className="min-w-0">
                <p className="flex items-baseline gap-2">
                    <span className="font-signage text-[34px] font-bold leading-none tabular">{weather.temperature}°</span>
                    <span className="text-[14px] text-muted-foreground">{weather.summary}</span>
                </p>
                <p className={cn('mt-1 text-[13px]', weather.rainInMin !== null ? 'font-medium text-foreground' : 'text-muted-foreground')}>{rain}</p>
            </div>
        </div>
    );
}

export default function AssistantCardView({ card }: { card: AssistantCard }) {
    switch (card.kind) {
        case 'itineraries':
            return <ItinerariesCard card={card} />;
        case 'route':
            return <RouteCard card={card} />;
        case 'places':
            return <PlacesCard card={card} />;
        case 'weather':
            return <WeatherCard weather={card.weather} />;
        case 'arrivals':
            return (
                <div className="space-y-2">
                    <ArrivalBoard paradero={card.paradero} title={card.title} limit={5} compact />
                    <Link href={`/mapa?estacion=${encodeURIComponent(card.paradero)}`} className="inline-flex items-center gap-1 px-1 text-[12px] font-semibold text-muted-foreground hover:text-foreground">
                        Ver la estación en el mapa <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                </div>
            );
    }
}
