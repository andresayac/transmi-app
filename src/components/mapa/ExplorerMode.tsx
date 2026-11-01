'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Map as MapboxMap } from 'mapbox-gl';
import { LocateFixed, Search, X } from 'lucide-react';
import BottomSheet from '@/components/ui/BottomSheet';
import { useToast } from '@/components/ui/Toast';
import { transmilenioApi } from '@/services/transmilenio';
import { haversine, formatDistance } from '@/lib/geo';
import { panelPadding } from '@/lib/layout';
import { ROUTE_COLORS } from '@/utils/constants';
import type { StationMapEntry } from '@/types/station';
import type { RouteSearchResult } from '@/types/route';
import { cn } from '@/lib/utils';
import type { ServiceLayers, StoredMultiRoute } from './types';
import { useStationsLayer } from './useStationsLayer';
import { usePointsLayer } from './usePointsLayer';
import StationSheet from './StationSheet';
import { LoadingPill } from './RoutesMode';

type SistemaFilter = 'all' | 'TransMilenio' | 'TransMiZonal';

interface Props {
    map: MapboxMap | null;
    ready: boolean;
    darkPreset: boolean;
    layers: ServiceLayers;
    userLat: number | null;
    userLng: number | null;
    onRequestLocation: () => void;
    /** Station code or id from ?estacion= */
    initialStation: string | null;
}

const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export default function ExplorerMode({ map, ready, darkPreset, layers, userLat, userLng, onRequestLocation, initialStation }: Props) {
    const router = useRouter();
    const toast = useToast();
    const [stations, setStations] = useState<StationMapEntry[]>([]);
    const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
    const [attempt, setAttempt] = useState(0);
    const [filter, setFilter] = useState<SistemaFilter>('all');
    const [query, setQuery] = useState('');
    const [selected, setSelected] = useState<StationMapEntry | null>(null);
    const [snap, setSnap] = useState(0);
    const deepLinkDone = useRef(false);

    const flyToStation = useCallback((s: StationMapEntry) => {
        map?.flyTo({ center: [s.lng, s.lat], zoom: 16.3, pitch: 50, duration: 1200, padding: panelPadding(window.innerHeight * 0.45) });
    }, [map]);

    const openStation = useCallback((s: StationMapEntry) => {
        setSelected(s);
        setQuery('');
        flyToStation(s);
    }, [flyToStation]);

    // Load all stations (client cache first, then server)
    useEffect(() => {
        let cancelled = false;
        transmilenioApi.getAllEstaciones(attempt > 0)
            .then((data) => {
                if (cancelled) return;
                setStations(data);
                setStatus(data.length ? 'ready' : 'error');
            })
            .catch(() => {
                if (!cancelled) setStatus('error');
            });
        return () => {
            cancelled = true;
        };
    }, [attempt]);

    // Deep link: /mapa?estacion=TM0002 (code) or the station id
    useEffect(() => {
        if (deepLinkDone.current || !initialStation || !stations.length || !map || !ready) return;
        deepLinkDone.current = true;
        const key = initialStation.trim().toLowerCase();
        const match = stations.find((s) => s.codigo.toLowerCase() === key || s.id === initialStation);
        if (match) {
            Promise.resolve().then(() => openStation(match));
        } else {
            toast.show('No encontramos esa estación', 'warning');
        }
    }, [initialStation, stations, map, ready, openStation, toast]);

    const filtered = useMemo(() => (filter === 'all' ? stations : stations.filter((s) => s.sistema === filter)), [stations, filter]);

    const nearIds = useMemo(() => {
        if (userLat === null || userLng === null) return new Set<string>();
        return new Set(
            filtered
                .map((s) => ({ id: s.id, d: (s.lat - userLat) ** 2 + (s.lng - userLng) ** 2 }))
                .sort((a, b) => a.d - b.d)
                .slice(0, 5)
                .map((x) => x.id),
        );
    }, [filtered, userLat, userLng]);

    const results = useMemo(() => {
        const q = normalize(query.trim());
        if (q.length < 2) return [];
        return stations
            .filter((s) => normalize(s.nombre).includes(q) || s.codigo.toLowerCase().includes(q))
            .sort((a, b) => (a.sistema === 'TransMilenio' ? 0 : 1) - (b.sistema === 'TransMilenio' ? 0 : 1))
            .slice(0, 12);
    }, [stations, query]);

    useStationsLayer(map, ready, filtered, nearIds, darkPreset, selected?.id ?? null, openStation);
    const pointsStatus = usePointsLayer(map, ready, layers, darkPreset);

    const goNearest = () => {
        if (userLat === null || userLng === null) {
            onRequestLocation();
            toast.show('Activa tu ubicación para encontrar la estación más cercana', 'warning');
            return;
        }
        const pool = filtered.length ? filtered : stations;
        if (!pool.length) return;
        let best = pool[0];
        let bestD = Infinity;
        for (const s of pool) {
            const d = (s.lat - userLat) ** 2 + (s.lng - userLng) ** 2;
            if (d < bestD) { bestD = d; best = s; }
        }
        openStation(best);
    };

    const openRoute = (r: RouteSearchResult) => {
        const params = new URLSearchParams({ id: r.id, nombre: r.nombre, codigo: r.codigo });
        router.push(`/mapa?${params.toString()}`);
    };

    const viewMany = (list: RouteSearchResult[]) => {
        const stored: StoredMultiRoute[] = list.map((r, i) => ({
            id: r.id,
            codigo: r.codigo,
            nombre: r.nombre,
            tipoServicio: r.tipoServicio,
            color: ROUTE_COLORS[i % ROUTE_COLORS.length],
            originalColor: r.color,
        }));
        sessionStorage.setItem('multiRoutes', JSON.stringify(stored));
        router.push('/mapa?multi=true');
    };

    const loadingPoints = pointsStatus.recarga === 'loading' || pointsStatus.personalizacion === 'loading';

    return (
        <>
            {status === 'loading' && <LoadingPill text="Cargando estaciones…" />}
            {status !== 'loading' && loadingPoints && <LoadingPill text="Cargando puntos TuLlave…" />}

            {selected ? (
                <StationSheet
                    key={selected.id}
                    station={selected}
                    onClose={() => setSelected(null)}
                    onOpenRoute={openRoute}
                    onViewMany={viewMany}
                />
            ) : (
                <BottomSheet
                    snaps={[184, 0.6]}
                    snap={snap}
                    onSnapChange={setSnap}
                    header={
                        <div className="px-4 pb-3 space-y-3">
                            <div className="flex items-center gap-2">
                                <label className="relative flex-1">
                                    <span className="sr-only">Buscar estación o paradero</span>
                                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                                    <input
                                        type="search"
                                        value={query}
                                        onPointerDown={(e) => e.stopPropagation()}
                                        onFocus={() => setSnap(1)}
                                        onChange={(e) => setQuery(e.target.value)}
                                        placeholder="Buscar estación o paradero"
                                        className="w-full h-12 pl-10 pr-10 rounded-full bg-secondary text-15 placeholder:text-muted-foreground border border-transparent focus:border-ring focus:outline-none"
                                    />
                                    {query && (
                                        <button
                                            onClick={() => setQuery('')}
                                            onPointerDown={(e) => e.stopPropagation()}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center hover:bg-accent"
                                            aria-label="Borrar búsqueda"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    )}
                                </label>
                                <button
                                    onClick={goNearest}
                                    onPointerDown={(e) => e.stopPropagation()}
                                    disabled={status !== 'ready'}
                                    className="h-12 px-4 rounded-full bg-foreground text-background flex items-center gap-2 text-14 font-semibold shrink-0 active:scale-95 transition disabled:opacity-50"
                                >
                                    <LocateFixed className="w-4 h-4" />
                                    Más cercana
                                </button>
                            </div>
                            <div className="flex items-center gap-1.5" onPointerDown={(e) => e.stopPropagation()}>
                                {(['all', 'TransMilenio', 'TransMiZonal'] as const).map((f) => (
                                    <button
                                        key={f}
                                        onClick={() => setFilter(f)}
                                        aria-pressed={filter === f}
                                        className={cn('h-8 px-3.5 rounded-full text-13 font-semibold transition', filter === f ? 'bg-foreground text-background' : 'bg-secondary text-muted-foreground hover:text-foreground')}
                                    >
                                        {f === 'all' ? 'Todas' : f === 'TransMilenio' ? 'TransMilenio' : 'Zonal'}
                                    </button>
                                ))}
                                <span className="ml-auto text-12 text-muted-foreground tabular">
                                    {status === 'ready' ? `${filtered.length.toLocaleString('es-CO')} paradas` : ''}
                                </span>
                            </div>
                        </div>
                    }
                >
                    <div className="px-2 pb-8">
                        {status === 'error' && (
                            <div className="mx-2 rounded-2xl bg-secondary p-4">
                                <p className="text-14 font-semibold">No pudimos cargar las estaciones</p>
                                <p className="text-13 text-muted-foreground mt-0.5">Revisa tu conexión e inténtalo de nuevo.</p>
                                <button
                                    onClick={() => { setStatus('loading'); setAttempt((a) => a + 1); }}
                                    className="mt-3 h-10 px-4 rounded-full bg-foreground text-background text-14 font-semibold"
                                >
                                    Reintentar
                                </button>
                            </div>
                        )}
                        {query.trim().length >= 2 && results.length === 0 && status === 'ready' && (
                            <p className="px-3 py-4 text-14 text-muted-foreground">No hay estaciones que coincidan con “{query.trim()}”. Prueba con otra parte del nombre o el código.</p>
                        )}
                        {results.length > 0 && (
                            <ul>
                                {results.map((s) => {
                                    const dist = userLat !== null && userLng !== null ? haversine({ lat: userLat, lng: userLng }, s) : null;
                                    const troncal = s.sistema === 'TransMilenio';
                                    return (
                                        <li key={s.id}>
                                            <button onClick={() => openStation(s)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-accent text-left">
                                                <span className={cn('shrink-0 border-[2.5px]', troncal ? 'w-4 h-4 rounded-[4px] border-foreground' : 'w-3 h-3 rounded-full border-muted-foreground ml-0.5 mr-0.5')} aria-hidden />
                                                <span className="flex-1 min-w-0">
                                                    <span className="block font-signage text-17 font-semibold truncate">{s.nombre}</span>
                                                    <span className="block text-12 text-muted-foreground truncate">{troncal ? 'TransMilenio' : 'Zonal'} · {s.direccion}</span>
                                                </span>
                                                {dist !== null && <span className="text-12 text-muted-foreground tabular shrink-0">{formatDistance(dist)}</span>}
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                        {query.trim().length < 2 && status === 'ready' && (
                            <p className="px-3 py-2 text-13 text-muted-foreground">
                                Toca una estación en el mapa para ver sus próximas llegadas y las rutas que paran ahí.
                            </p>
                        )}
                    </div>
                </BottomSheet>
            )}
        </>
    );
}
