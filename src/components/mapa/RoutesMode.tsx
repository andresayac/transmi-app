'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type { Map as MapboxMap } from 'mapbox-gl';
import { ChevronDown, Eye, EyeOff, Loader2, Share2, Star } from 'lucide-react';
import BottomSheet from '@/components/ui/BottomSheet';
import RouteBadge from '@/components/transit/RouteBadge';
import { useToast } from '@/components/ui/Toast';
import { useAppStore, useHydrated } from '@/stores/app';
import { shareRoute } from '@/utils/share';
import { colorForRouteCode } from '@/lib/color';
import { isActiveNow, operatesToday } from '@/lib/schedule';
import type { RouteDetailNormalized } from '@/types/transit';
import { cn } from '@/lib/utils';
import type { MapRoute, StoredMultiRoute } from './types';
import { useRouteLayers, fitRoutes } from './useRouteLayers';
import { useBusMarkers, BusGroup } from './useBusMarkers';
import { useLiveBuses } from './useLiveBuses';
import RouteDiagram from './RouteDiagram';
import SchedulesList from './SchedulesList';

interface Props {
    map: MapboxMap | null;
    ready: boolean;
    darkPreset: boolean;
    multi: boolean;
    initial: StoredMultiRoute[];
}

type Selection = { routeKey: string; stopIndex: number } | null;

const SNAPS = [176, 0.52, 0.9];

function toMapRoute(r: StoredMultiRoute, multi: boolean): MapRoute {
    const own = colorForRouteCode(r.codigo, r.originalColor);
    return {
        key: r.id,
        id: r.id,
        codigo: r.codigo,
        nombre: r.nombre,
        tipoServicio: r.tipoServicio,
        color: multi ? r.color : own,
        originalColor: own,
        visible: true,
        detail: null,
        status: 'loading',
    };
}

async function fetchDetail(r: MapRoute): Promise<RouteDetailNormalized> {
    const res = await fetch(`/api/routes/detail?id=${encodeURIComponent(r.id)}&nombre=${encodeURIComponent(r.nombre)}&codigo=${encodeURIComponent(r.codigo)}`);
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error || 'error');
    return json as RouteDetailNormalized;
}

export default function RoutesMode({ map, ready, darkPreset, multi, initial }: Props) {
    const toast = useToast();
    const hydrated = useHydrated();
    const favorites = useAppStore((s) => s.favorites);
    const addFavorite = useAppStore((s) => s.addFavorite);
    const removeFavorite = useAppStore((s) => s.removeFavorite);

    const [routes, setRoutes] = useState<MapRoute[]>(() => initial.map((r) => toMapRoute(r, multi)));
    const [attempt, setAttempt] = useState(0);
    const [selection, setSelection] = useState<Selection>(null);
    const [focusedKey, setFocusedKey] = useState<string | null>(multi ? null : initial[0]?.id ?? null);
    const [tab, setTab] = useState<'recorrido' | 'horarios'>('recorrido');
    const [snap, setSnap] = useState(1);
    const [panelOpen, setPanelOpen] = useState(false);
    const fitted = useRef(false);

    // Load every route's normalized detail (real geometry + stops + schedules)
    useEffect(() => {
        let cancelled = false;
        const base = initial.map((r) => toMapRoute(r, multi));
        Promise.allSettled(base.map(fetchDetail)).then((results) => {
            if (cancelled) return;
            setRoutes((prev) => base.map((r, i) => {
                const res = results[i];
                const visible = prev.find((p) => p.key === r.key)?.visible ?? true;
                if (res.status === 'rejected') return { ...r, visible, status: 'error' as const };
                const detail = res.value;
                return {
                    ...r,
                    visible,
                    detail,
                    status: 'ready' as const,
                    color: multi ? r.color : detail.color,
                    originalColor: multi ? r.originalColor : detail.color,
                };
            }));
        });
        return () => {
            cancelled = true;
        };
    }, [initial, multi, attempt]);

    const retry = () => {
        setRoutes((prev) => prev.map((r) => (r.status === 'error' ? { ...r, status: 'loading' as const } : r)));
        setAttempt((a) => a + 1);
    };

    const loading = routes.some((r) => r.status === 'loading');
    const failedAll = !loading && routes.length > 0 && routes.every((r) => r.status === 'error');

    // Fit the camera once everything is loaded
    useEffect(() => {
        if (!map || !ready || loading || fitted.current) return;
        const drawn = routes.filter((r) => r.detail && r.visible);
        if (!drawn.length) return;
        fitted.current = true;
        fitRoutes(map, drawn, window.innerHeight * 0.5);
    }, [map, ready, loading, routes]);

    // Live buses for visible routes that run today
    const liveRequests = useMemo(
        () => routes
            .filter((r) => r.visible && r.detail && operatesToday(r.detail.schedules))
            .map((r) => ({ key: r.key, codigo: r.codigo, nombre: r.nombre })),
        [routes],
    );
    const { byRoute } = useLiveBuses(liveRequests);

    const groups: BusGroup[] = useMemo(
        () => routes
            .filter((r) => r.visible)
            .map((r) => ({ key: r.key, color: r.color, routeCode: r.codigo, buses: byRoute[r.key] || [] })),
        [routes, byRoute],
    );
    const { focusBus } = useBusMarkers(map, groups);
    const totalBuses = groups.reduce((s, g) => s + g.buses.length, 0);

    const flyToStop = useCallback((routeKey: string, index: number) => {
        const stop = routes.find((r) => r.key === routeKey)?.detail?.stops[index];
        if (!stop || !map) return;
        map.flyTo({ center: [stop.lng, stop.lat], zoom: Math.max(map.getZoom(), 15.5), duration: 900, padding: { top: 0, bottom: window.innerHeight * 0.45, left: 0, right: 0 } });
    }, [routes, map]);

    const selectStop = useCallback((routeKey: string, index: number) => {
        setSelection({ routeKey, stopIndex: index });
        setFocusedKey(routeKey);
        setTab('recorrido');
        setSnap((s) => Math.max(s, 1));
        flyToStop(routeKey, index);
    }, [flyToStop]);

    useRouteLayers(map, ready, routes, { darkPreset, onStopClick: selectStop, highlight: selection });

    const toggleVisible = (key: string) => setRoutes((prev) => prev.map((r) => (r.key === key ? { ...r, visible: !r.visible } : r)));
    const setAllVisible = (visible: boolean) => setRoutes((prev) => prev.map((r) => ({ ...r, visible })));

    const focusRoute = (key: string) => {
        const next = focusedKey === key ? null : key;
        setFocusedKey(next);
        if (selection?.routeKey !== key) setSelection(null);
        const route = routes.find((r) => r.key === key);
        if (next && route && map) fitRoutes(map, [route], window.innerHeight * 0.55);
    };

    const onBusClick = (routeKey: string, busId: string) => {
        setSnap(0);
        focusBus(routeKey, busId);
    };

    // ─── Single route ─────────────────────────────────────
    if (!multi) {
        const route = routes[0];
        if (!route) return null;
        const isFav = hydrated && favorites.some((f) => f.id === route.id);
        const active = route.detail ? isActiveNow(route.detail.schedules) : null;
        const buses = byRoute[route.key] || [];

        const toggleFav = () => {
            if (isFav) {
                removeFavorite(route.id);
                toast.show(`${route.codigo} ya no está en guardados`, 'info');
            } else {
                addFavorite({ id: route.id, codigo: route.codigo, nombre: route.nombre, tipoServicio: route.tipoServicio || route.detail?.serviceType, color: route.originalColor });
                toast.show(`${route.codigo} guardada`, 'success');
            }
        };
        const share = async () => {
            const result = await shareRoute({ id: route.id, nombre: route.nombre, codigo: route.codigo });
            if (result.success && result.method === 'clipboard') toast.show('Enlace copiado', 'success');
        };

        return (
            <>
                {loading && <LoadingPill text="Cargando ruta…" />}
                <BottomSheet
                    snaps={SNAPS}
                    snap={snap}
                    onSnapChange={setSnap}
                    header={
                        <div className="px-4 pb-3">
                            <div className="flex items-center gap-3">
                                <RouteBadge code={route.codigo} color={route.originalColor} size="lg" inactive={active === false} />
                                <div className="flex-1 min-w-0">
                                    <h2 className="font-signage text-[22px] font-bold leading-tight truncate">{route.detail?.name || route.nombre}</h2>
                                    <p className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
                                        {active === true && <><span className="live-dot" /> Operando ahora</>}
                                        {active === false && <>Fuera de horario</>}
                                        {active === null && route.status === 'ready' && <>Sin horario publicado</>}
                                        {route.status === 'ready' && <span className="tabular">· {buses.length} {buses.length === 1 ? 'bus' : 'buses'} en vivo</span>}
                                    </p>
                                </div>
                                <button onClick={toggleFav} onPointerDown={(e) => e.stopPropagation()} className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-accent active:scale-90 transition" aria-label={isFav ? 'Quitar de guardados' : 'Guardar ruta'} aria-pressed={isFav}>
                                    <Star className={cn('w-5 h-5', isFav && 'fill-current')} />
                                </button>
                                <button onClick={share} onPointerDown={(e) => e.stopPropagation()} className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-accent active:scale-90 transition" aria-label="Compartir ruta">
                                    <Share2 className="w-5 h-5" />
                                </button>
                            </div>
                            <Tabs tab={tab} onChange={setTab} />
                        </div>
                    }
                >
                    <div className="px-4 pb-8 pt-1">
                        {route.status === 'loading' && <DiagramSkeleton />}
                        {route.status === 'error' && <LoadError onRetry={retry} />}
                        {route.status === 'ready' && tab === 'recorrido' && (
                            <RouteDiagram
                                route={route}
                                buses={buses}
                                selectedIndex={selection?.routeKey === route.key ? selection.stopIndex : null}
                                onStopClick={(i) => selectStop(route.key, i)}
                                onCloseStop={() => setSelection(null)}
                                onBusClick={(busId) => onBusClick(route.key, busId)}
                            />
                        )}
                        {route.status === 'ready' && tab === 'horarios' && <SchedulesList schedules={route.detail?.schedules || []} />}
                    </div>
                </BottomSheet>
            </>
        );
    }

    // ─── Multi-route comparison ───────────────────────────
    const visibleCount = routes.filter((r) => r.visible).length;

    return (
        <>
            {loading && <LoadingPill text={`Cargando ${routes.length} rutas…`} />}

            {/* Visibility panel */}
            <div className="absolute left-16 z-40" style={{ top: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}>
                <button
                    onClick={() => setPanelOpen((v) => !v)}
                    className="glass h-11 rounded-full pl-2 pr-3 flex items-center gap-2 shadow-lg active:scale-95 transition"
                    aria-expanded={panelOpen}
                >
                    <span className="flex -space-x-1.5">
                        {routes.slice(0, 4).map((r) => (
                            <span key={r.key} className="w-5 h-5 rounded-full ring-2 ring-background" style={{ backgroundColor: r.color, opacity: r.visible ? 1 : 0.3 }} />
                        ))}
                    </span>
                    <span className="text-[14px] font-semibold tabular">{visibleCount}/{routes.length} rutas</span>
                    <ChevronDown className={cn('w-4 h-4 transition-transform', panelOpen && 'rotate-180')} />
                </button>
                {panelOpen && (
                    <div className="mt-2 w-[270px] max-h-[50dvh] overflow-y-auto rounded-2xl bg-background border border-border shadow-2xl p-2 animate-slide-up">
                        <div className="flex items-center justify-between px-2 py-1.5">
                            <span className="text-[13px] text-muted-foreground">Mostrar en el mapa</span>
                            <div className="flex gap-1">
                                <button onClick={() => setAllVisible(true)} className="px-2.5 h-7 rounded-full text-[12px] font-semibold hover:bg-accent">Todas</button>
                                <button onClick={() => setAllVisible(false)} className="px-2.5 h-7 rounded-full text-[12px] font-semibold hover:bg-accent">Ninguna</button>
                            </div>
                        </div>
                        {routes.map((r) => (
                            <button
                                key={r.key}
                                onClick={() => toggleVisible(r.key)}
                                className={cn('w-full flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-accent transition', !r.visible && 'opacity-45')}
                                aria-pressed={r.visible}
                            >
                                <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: r.color }} />
                                <RouteBadge code={r.codigo} color={r.originalColor} size="xs" />
                                <span className="flex-1 min-w-0 text-left text-[13px] truncate">{r.nombre}</span>
                                {r.visible ? <Eye className="w-4 h-4 text-muted-foreground" /> : <EyeOff className="w-4 h-4 text-muted-foreground" />}
                            </button>
                        ))}
                    </div>
                )}
            </div>
            {panelOpen && <div className="absolute inset-0 z-30" onClick={() => setPanelOpen(false)} aria-hidden />}

            <BottomSheet
                snaps={SNAPS}
                snap={snap}
                onSnapChange={setSnap}
                header={
                    <div className="px-4 pb-3">
                        <h2 className="font-signage text-[22px] font-bold leading-tight">Comparando {routes.length} rutas</h2>
                        <p className="text-[13px] text-muted-foreground tabular">
                            {visibleCount} visibles · {totalBuses} {totalBuses === 1 ? 'bus' : 'buses'} en vivo · toca una ruta para ver su recorrido
                        </p>
                    </div>
                }
            >
                <div className="px-3 pb-8 space-y-1.5">
                    {failedAll && <LoadError onRetry={retry} />}
                    {routes.map((r) => {
                        const isOpen = focusedKey === r.key;
                        const buses = byRoute[r.key] || [];
                        const active = r.detail ? isActiveNow(r.detail.schedules) : null;
                        return (
                            <div key={r.key} className={cn('rounded-2xl transition', isOpen && 'bg-secondary/60')}>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => focusRoute(r.key)}
                                        className={cn('flex-1 min-w-0 flex items-center gap-3 px-2 py-2.5 rounded-2xl text-left hover:bg-accent/60 transition', !r.visible && 'opacity-45')}
                                        aria-expanded={isOpen}
                                    >
                                        <span className="w-1.5 self-stretch rounded-full shrink-0" style={{ backgroundColor: r.color }} aria-hidden />
                                        <RouteBadge code={r.codigo} color={r.originalColor} size="md" inactive={active === false} />
                                        <span className="flex-1 min-w-0">
                                            <span className="block font-signage text-[17px] font-semibold truncate">{r.nombre}</span>
                                            <span className="block text-[12px] text-muted-foreground tabular">
                                                {r.status === 'loading' && 'Cargando…'}
                                                {r.status === 'error' && 'No se pudo cargar'}
                                                {r.status === 'ready' && `${r.detail?.stops.length ?? 0} paradas · ${buses.length} en vivo${active === false ? ' · fuera de horario' : ''}`}
                                            </span>
                                        </span>
                                        <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform shrink-0', isOpen && 'rotate-180')} />
                                    </button>
                                    <button
                                        onClick={() => toggleVisible(r.key)}
                                        className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-accent shrink-0"
                                        aria-label={r.visible ? `Ocultar ${r.codigo}` : `Mostrar ${r.codigo}`}
                                        aria-pressed={r.visible}
                                    >
                                        {r.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4 text-muted-foreground" />}
                                    </button>
                                </div>
                                {isOpen && r.status === 'ready' && (
                                    <div className="px-2 pb-3 pt-1">
                                        <RouteDiagram
                                            route={r}
                                            buses={buses}
                                            selectedIndex={selection?.routeKey === r.key ? selection.stopIndex : null}
                                            onStopClick={(i) => selectStop(r.key, i)}
                                            onCloseStop={() => setSelection(null)}
                                            onBusClick={(busId) => onBusClick(r.key, busId)}
                                        />
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </BottomSheet>
        </>
    );
}

function Tabs({ tab, onChange }: { tab: 'recorrido' | 'horarios'; onChange: (t: 'recorrido' | 'horarios') => void }) {
    return (
        <div role="tablist" className="mt-3 grid grid-cols-2 gap-1 rounded-full bg-secondary p-1" onPointerDown={(e) => e.stopPropagation()}>
            {(['recorrido', 'horarios'] as const).map((t) => (
                <button
                    key={t}
                    role="tab"
                    aria-selected={tab === t}
                    onClick={() => onChange(t)}
                    className={cn('h-8 rounded-full text-[14px] font-semibold transition', tab === t ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground')}
                >
                    {t === 'recorrido' ? 'Recorrido' : 'Horarios'}
                </button>
            ))}
        </div>
    );
}

export function LoadingPill({ text }: { text: string }) {
    return (
        <div className="absolute left-1/2 -translate-x-1/2 z-40 glass rounded-full px-4 h-10 flex items-center gap-2 shadow-lg" style={{ top: 'calc(env(safe-area-inset-top, 0px) + 66px)' }} role="status">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-[13px] font-medium">{text}</span>
        </div>
    );
}

function DiagramSkeleton() {
    return (
        <div className="space-y-3 pt-2" aria-hidden>
            {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                    <div className="w-4 h-4 rounded-full bg-secondary animate-pulse ml-3.5" />
                    <div className="h-4 rounded bg-secondary animate-pulse" style={{ width: `${50 + ((i * 17) % 35)}%` }} />
                </div>
            ))}
        </div>
    );
}

function LoadError({ onRetry }: { onRetry: () => void }) {
    return (
        <div className="rounded-2xl bg-secondary p-4">
            <p className="text-[14px] font-semibold">No pudimos cargar la ruta</p>
            <p className="text-[13px] text-muted-foreground mt-0.5">Revisa tu conexión e inténtalo de nuevo. Si sigue fallando, búscala otra vez desde Explorar.</p>
            <div className="mt-3 flex gap-2">
                <button onClick={onRetry} className="h-10 px-4 rounded-full bg-foreground text-background text-[14px] font-semibold">Reintentar</button>
                <Link href="/explorar" className="h-10 px-4 rounded-full border border-border flex items-center text-[14px] font-semibold">Ir a Explorar</Link>
            </div>
        </div>
    );
}
