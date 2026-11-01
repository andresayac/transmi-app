'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Map as MapIcon, Navigation, Search, X } from 'lucide-react';
import AppHeader from '@/components/layout/AppHeader';
import { transmilenioApi } from '@/services/transmilenio';
import { useToast } from '@/components/ui/Toast';
import { Skeleton } from '@/components/ui/skeleton';
import ArrivalBoard from '@/components/transit/ArrivalBoard';
import PinStopButton from '@/components/transit/PinStopButton';
import LineDiagram from '@/components/transit/LineDiagram';
import RouteRow from '@/components/transit/RouteRow';
import { useRouteSearch } from '@/hooks/useRouteSearch';
import { useFavorites } from '@/hooks/useFavorites';
import { useSelectedRoutes } from '@/hooks/useSelectedRoutes';
import { useSearchHistory } from '@/hooks/useSearchHistory';
import { shareRoute } from '@/utils/share';
import { parseCoord } from '@/lib/geo';
import { readableOn } from '@/lib/color';
import { Troncal, Estacion, ZonaOperacional, Parada } from '@/types/explorar';
import { RouteSearchResult } from '@/types/route';
import { cn } from '@/lib/utils';

type Tab = 'rutas' | 'troncales' | 'zonas' | 'paradas';

type Drill =
    | { type: 'list' }
    | { type: 'estaciones'; troncal: Troncal }
    | { type: 'estacion'; stop: { id: string; codigo: string; nombre: string; direccion: string; coordenada?: string }; troncal?: Troncal }
    | { type: 'zona'; zona: ZonaOperacional };

const TABS: { key: Tab; label: string }[] = [
    { key: 'rutas', label: 'Rutas' },
    { key: 'troncales', label: 'Troncales' },
    { key: 'zonas', label: 'Zonas' },
    { key: 'paradas', label: 'Paradas' },
];

const ROUTE_FILTERS = [
    { key: 'all', label: 'Todas' },
    { key: 'TransMilenio', label: 'TransMilenio' },
    { key: 'TransMiZonal', label: 'Zonal' },
    { key: 'SITP', label: 'SITP' },
];

function SearchField({ value, onChange, onSubmit, placeholder, autoFocus }: {
    value: string;
    onChange: (v: string) => void;
    onSubmit?: () => void;
    placeholder: string;
    autoFocus?: boolean;
}) {
    return (
        <form className="relative" role="search" onSubmit={(e) => { e.preventDefault(); onSubmit?.(); }}>
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-muted-foreground" />
            <input
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                autoFocus={autoFocus}
                aria-label={placeholder}
                enterKeyHint="search"
                className="w-full h-12 rounded-2xl bg-secondary pl-11 pr-10 text-16 placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-ring"
            />
            {value && (
                <button type="button" onClick={() => onChange('')} className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-accent" aria-label="Borrar búsqueda">
                    <X className="w-4 h-4" />
                </button>
            )}
        </form>
    );
}

function ListSkeleton() {
    return (
        <div className="space-y-1">
            {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-3 py-3">
                    <Skeleton className="w-11 h-8 rounded-lg" />
                    <div className="flex-1">
                        <Skeleton className="w-2/3 h-4 mb-1.5" />
                        <Skeleton className="w-1/3 h-3" />
                    </div>
                </div>
            ))}
        </div>
    );
}

function ExplorarContent() {
    const router = useRouter();
    const params = useSearchParams();
    const toast = useToast();

    const initialQ = params.get('q') || '';
    const initialTab = (params.get('tab') as Tab) || 'rutas';

    const [tab, setTab] = useState<Tab>(TABS.some((t) => t.key === initialTab) ? initialTab : 'rutas');
    const [drill, setDrill] = useState<Drill>({ type: 'list' });

    const [troncales, setTroncales] = useState<Troncal[]>([]);
    const [estaciones, setEstaciones] = useState<Estacion[]>([]);
    const [zonas, setZonas] = useState<ZonaOperacional[]>([]);
    const [paradas, setParadas] = useState<Parada[]>([]);
    const [rutas, setRutas] = useState<RouteSearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [paradaSearch, setParadaSearch] = useState('');
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Route search (moved here from the v2 home)
    const { results, loading: searching, error: searchError, searchTerm, search, setSearchTerm } = useRouteSearch();
    const { isFavorite, addFavorite, removeFavorite } = useFavorites();
    const { isSelected, toggleRoute, clearAll, selectedCount, getSelectedArray, getColor } = useSelectedRoutes();
    const { history, addSearch, removeItem, clearHistory } = useSearchHistory();
    const [filter, setFilter] = useState('all');

    useEffect(() => {
        if (initialQ) {
            setSearchTerm(initialQ);
            search(initialQ);
            addSearch(initialQ);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialQ]);

    const runSearch = (term: string) => {
        if (!term.trim()) return;
        search(term);
        addSearch(term);
        setFilter('all');
        router.replace(`/explorar?q=${encodeURIComponent(term.trim())}`, { scroll: false });
    };

    const filtered = useMemo(() => (filter === 'all' ? results : results.filter((r) => r.tipoServicio === filter)), [results, filter]);
    const counts = useMemo(() => {
        const c: Record<string, number> = { all: results.length };
        results.forEach((r) => { c[r.tipoServicio] = (c[r.tipoServicio] || 0) + 1; });
        return c;
    }, [results]);

    const load = useCallback(async <T,>(fn: () => Promise<T>, onOk: (v: T) => void, errorMsg: string) => {
        setLoading(true);
        try { onOk(await fn()); } catch { toast.show(errorMsg, 'error'); }
        setLoading(false);
    }, [toast]);

    useEffect(() => {
        if (tab === 'troncales' && troncales.length === 0) load(() => transmilenioApi.getTroncales(), setTroncales, 'No se pudieron cargar las troncales');
        if (tab === 'zonas' && zonas.length === 0) load(() => transmilenioApi.getZonas(), setZonas, 'No se pudieron cargar las zonas');
    }, [tab, troncales.length, zonas.length, load]);

    const openTroncal = (troncal: Troncal) => {
        setDrill({ type: 'estaciones', troncal });
        setEstaciones([]);
        load(() => transmilenioApi.getEstacionesByTroncal(troncal.id), setEstaciones, 'No se pudieron cargar las estaciones');
    };

    const openStop = (stop: Drill & { type: 'estacion' }) => {
        setDrill(stop);
        setRutas([]);
        load(
            () => transmilenioApi.getRutasByEstacion(stop.stop.id),
            (data) => setRutas(data.filter((r, i, arr) => arr.findIndex((x) => x.id === r.id) === i)),
            'No se pudieron cargar las rutas',
        );
        window.scrollTo({ top: 0 });
    };

    const openZona = (zona: ZonaOperacional) => {
        setDrill({ type: 'zona', zona });
        setRutas([]);
        load(() => transmilenioApi.getRutasByZona(zona.id), setRutas, 'No se pudieron cargar las rutas');
    };

    const searchParadas = useCallback((term: string) => {
        if (term.trim().length < 2) { setParadas([]); return; }
        load(() => transmilenioApi.searchParadas(term), setParadas, 'No se pudieron buscar paradas');
    }, [load]);

    const goBack = () => {
        if (drill.type === 'estacion' && drill.troncal) { openTroncal(drill.troncal); return; }
        setDrill({ type: 'list' });
        setRutas([]);
    };

    const openRoute = (route: RouteSearchResult) => {
        router.push(`/mapa?${new URLSearchParams({ id: route.id, nombre: route.nombre, codigo: route.codigo }).toString()}`);
    };

    const toggleFavorite = (route: RouteSearchResult) => {
        if (isFavorite(route.id)) {
            removeFavorite(route.id);
            toast.show(`${route.codigo} quitada de guardados`, 'info');
        } else {
            addFavorite(route);
            toast.show(`${route.codigo} guardada`, 'success');
        }
    };

    const share = async (route: RouteSearchResult) => {
        const result = await shareRoute(route);
        if (result.success && result.method === 'clipboard') toast.show('Enlace copiado', 'success');
    };

    const toggleCompare = (route: RouteSearchResult) => {
        const adding = !isSelected(route.id);
        toggleRoute(route);
        if (adding && selectedCount + 1 === 8) toast.show('Con muchas rutas el mapa puede ir más lento', 'warning');
    };

    const compareOnMap = () => {
        const selected = getSelectedArray();
        if (!selected.length) return;
        sessionStorage.setItem('multiRoutes', JSON.stringify(selected));
        router.push('/mapa?multi=true');
    };

    const routeList = (list: RouteSearchResult[]) => (
        <div>
            {list.map((r) => (
                <RouteRow
                    key={r.id}
                    route={r}
                    onOpen={openRoute}
                    isFavorite={isFavorite(r.id)}
                    onToggleFavorite={toggleFavorite}
                    onShare={share}
                    selected={isSelected(r.id)}
                    selectionColor={getColor(r.id)}
                    onToggleSelect={toggleCompare}
                />
            ))}
        </div>
    );

    const title = drill.type === 'estaciones' ? drill.troncal.nombre
        : drill.type === 'estacion' ? drill.stop.nombre
            : drill.type === 'zona' ? drill.zona.nombre
                : null;

    return (
        <div className="safe-bottom">
            <AppHeader title="Explorar" />

            {drill.type === 'list' ? (
                <div className="sticky top-[59px] z-30 bg-background/95 backdrop-blur px-4 pt-3 pb-2">
                    <div role="tablist" aria-label="Secciones" className="grid grid-cols-4 p-1 rounded-2xl bg-secondary">
                        {TABS.map((t) => (
                            <button
                                key={t.key}
                                role="tab"
                                aria-selected={tab === t.key}
                                onClick={() => { setTab(t.key); setDrill({ type: 'list' }); }}
                                className={cn(
                                    'h-9 rounded-xl text-14 font-semibold transition',
                                    tab === t.key ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                                )}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="px-4 pt-4 pb-1 flex items-center gap-2">
                    <button onClick={goBack} className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center hover:bg-accent active:scale-90 transition" aria-label="Volver">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="min-w-0">
                        <h2 className="font-signage text-26 font-bold leading-none truncate">{title}</h2>
                        {drill.type === 'estaciones' && <p className="text-13 text-muted-foreground mt-1">Troncal {drill.troncal.letra} · {estaciones.length || '…'} estaciones</p>}
                        {drill.type === 'estacion' && <p className="text-13 text-muted-foreground mt-1 truncate">{drill.stop.direccion}</p>}
                        {drill.type === 'zona' && <p className="text-13 text-muted-foreground mt-1">{rutas.length || '…'} rutas zonales</p>}
                    </div>
                </div>
            )}

            <main className="px-4 pt-2">
                {/* ── Rutas ─────────────────────────── */}
                {drill.type === 'list' && tab === 'rutas' && (
                    <div className="space-y-3">
                        <SearchField
                            value={searchTerm}
                            onChange={setSearchTerm}
                            onSubmit={() => runSearch(searchTerm)}
                            placeholder="Código o nombre: B23, K10, Suba…"
                            autoFocus={!initialQ}
                        />

                        {!results.length && !searching && history.length > 0 && (
                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-13 text-muted-foreground">Búsquedas recientes</span>
                                    <button onClick={clearHistory} className="text-13 text-muted-foreground hover:text-foreground">Borrar</button>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {history.map((term) => (
                                        <span key={term} className="inline-flex items-center h-8 rounded-full bg-secondary text-14">
                                            <button onClick={() => { setSearchTerm(term); runSearch(term); }} className="pl-3 pr-1.5 h-full">{term}</button>
                                            <button onClick={() => removeItem(term)} className="pr-2 h-full text-muted-foreground" aria-label={`Quitar ${term}`}><X className="w-3.5 h-3.5" /></button>
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {results.length > 0 && (
                            <div className="flex gap-1.5 overflow-x-auto scrollbar-hidden -mx-4 px-4">
                                {ROUTE_FILTERS.filter((f) => f.key === 'all' || counts[f.key]).map((f) => (
                                    <button
                                        key={f.key}
                                        onClick={() => setFilter(f.key)}
                                        className={cn('h-8 px-3 rounded-full text-13 font-semibold whitespace-nowrap transition', filter === f.key ? 'bg-foreground text-background' : 'bg-secondary text-muted-foreground')}
                                    >
                                        {f.label} <span className="opacity-60 tabular">{counts[f.key] || 0}</span>
                                    </button>
                                ))}
                            </div>
                        )}

                        {searching && <ListSkeleton />}
                        {searchError && <p className="text-14 text-destructive">{searchError}</p>}
                        {!searching && searchTerm && results.length === 0 && !searchError && initialQ !== '' && (
                            <p className="text-14 text-muted-foreground py-6 text-center">No encontramos rutas con “{searchTerm}”. Prueba con el código (por ejemplo B23) o el destino.</p>
                        )}
                        {!searching && filtered.length > 0 && routeList(filtered)}

                        {!searching && !results.length && !history.length && (
                            <p className="text-14 text-muted-foreground pt-2">
                                Busca por código o destino. Marca con + las rutas que quieras comparar en el mapa.
                            </p>
                        )}
                    </div>
                )}

                {/* ── Troncales ─────────────────────── */}
                {drill.type === 'list' && tab === 'troncales' && (
                    loading && !troncales.length ? <ListSkeleton /> : (
                        <div className="grid grid-cols-3 gap-2.5 pt-1">
                            {troncales.map((t) => (
                                <button
                                    key={t.id}
                                    onClick={() => openTroncal(t)}
                                    className="flex flex-col items-start gap-2 p-3 rounded-2xl border border-border hover:bg-accent/60 active:scale-[0.97] transition text-left"
                                >
                                    <span className="font-signage w-11 h-11 rounded-xl flex items-center justify-center text-28 font-bold" style={{ backgroundColor: t.color, color: readableOn(t.color) }}>
                                        {t.letra}
                                    </span>
                                    <span className="font-signage text-16 font-semibold leading-tight line-clamp-2">{t.nombre}</span>
                                </button>
                            ))}
                        </div>
                    )
                )}

                {drill.type === 'estaciones' && (
                    loading && !estaciones.length ? <ListSkeleton /> : (
                        <LineDiagram
                            className="mt-2"
                            color={drill.troncal.color}
                            rowHeight={56}
                            stops={estaciones.map((e) => ({ id: e.id, name: e.nombre, sub: e.direccion, isPortal: /portal/i.test(e.nombre) }))}
                            onStopClick={(i) => openStop({ type: 'estacion', stop: estaciones[i], troncal: drill.troncal })}
                        />
                    )
                )}

                {/* ── Zonas ─────────────────────────── */}
                {drill.type === 'list' && tab === 'zonas' && (
                    loading && !zonas.length ? <ListSkeleton /> : (
                        <div>
                            {zonas.map((z) => (
                                <button key={z.id} onClick={() => openZona(z)} className="w-full flex items-center justify-between py-3.5 border-b border-border last:border-0 text-left hover:bg-accent/40 active:bg-accent transition">
                                    <span className="font-signage text-19 font-semibold">{z.nombre}</span>
                                    <span className="text-13 text-muted-foreground tabular">{z.cantiad} rutas</span>
                                </button>
                            ))}
                        </div>
                    )
                )}

                {drill.type === 'zona' && (loading ? <ListSkeleton /> : routeList(rutas))}

                {/* ── Paradas ───────────────────────── */}
                {drill.type === 'list' && tab === 'paradas' && (
                    <div className="space-y-2">
                        <SearchField
                            value={paradaSearch}
                            onChange={(v) => {
                                setParadaSearch(v);
                                if (debounceRef.current) clearTimeout(debounceRef.current);
                                debounceRef.current = setTimeout(() => searchParadas(v), 350);
                            }}
                            onSubmit={() => searchParadas(paradaSearch)}
                            placeholder="Nombre de la parada o estación"
                        />
                        {loading && <ListSkeleton />}
                        {!loading && paradas.map((p) => (
                            <button
                                key={p.id}
                                onClick={() => openStop({ type: 'estacion', stop: p })}
                                className="w-full flex items-center gap-3 py-3 border-b border-border last:border-0 text-left hover:bg-accent/40 active:bg-accent transition"
                            >
                                <span className={cn('w-2.5 h-2.5 shrink-0', p.sistema === 'TransMilenio' ? 'rounded-[3px] bg-foreground' : 'rounded-full bg-muted-foreground')} />
                                <span className="flex-1 min-w-0">
                                    <span className="block font-signage text-18 font-semibold leading-tight truncate">{p.nombre}</span>
                                    <span className="block text-12 text-muted-foreground truncate">{p.direccion} · {p.sistema}</span>
                                </span>
                                <span className="text-12 text-muted-foreground tabular shrink-0">{p.codigo}</span>
                            </button>
                        ))}
                        {!loading && paradaSearch.length >= 2 && paradas.length === 0 && (
                            <p className="text-14 text-muted-foreground py-6 text-center">Sin resultados para “{paradaSearch}”.</p>
                        )}
                        {!paradaSearch && (
                            <p className="text-14 text-muted-foreground pt-1">Busca una parada zonal o una estación para ver sus llegadas en vivo y las rutas que pasan.</p>
                        )}
                    </div>
                )}

                {/* ── Station / stop detail ─────────── */}
                {drill.type === 'estacion' && (() => {
                    const c = parseCoord(drill.stop.coordenada);
                    return (
                        <div className="space-y-5 pt-2">
                            <div className="flex gap-2">
                                <Link
                                    href={`/mapa?estacion=${encodeURIComponent(drill.stop.codigo)}`}
                                    className="flex-1 inline-flex items-center justify-center gap-2 h-11 rounded-xl border border-border font-semibold text-14 hover:bg-accent active:scale-[0.98] transition"
                                >
                                    <MapIcon className="w-4 h-4" /> Ver en el mapa
                                </Link>
                                {c && (
                                    <Link
                                        href={`/planear?${new URLSearchParams({ toLat: String(c.lat), toLng: String(c.lng), toName: drill.stop.nombre }).toString()}`}
                                        className="flex-1 inline-flex items-center justify-center gap-2 h-11 rounded-xl bg-foreground text-background font-semibold text-14 active:scale-[0.98] transition"
                                    >
                                        <Navigation className="w-4 h-4" /> Cómo llegar
                                    </Link>
                                )}
                                {c && (
                                    <PinStopButton
                                        className="w-11 h-11 rounded-xl"
                                        stop={{ codigo: drill.stop.codigo, nombre: drill.stop.nombre, lat: c.lat, lng: c.lng, sistema: 'sistema' in drill.stop ? String((drill.stop as { sistema?: string }).sistema || '') : '' }}
                                    />
                                )}
                            </div>
                            <ArrivalBoard paradero={drill.stop.codigo} title="Próximas llegadas" limit={8} />
                            <section>
                                <h3 className="font-signage text-22 font-bold mb-1">Rutas que paran aquí</h3>
                                {loading ? <ListSkeleton /> : rutas.length ? routeList(rutas) : <p className="text-14 text-muted-foreground py-4">No encontramos rutas para esta parada.</p>}
                            </section>
                        </div>
                    );
                })()}
            </main>

            {/* Comparison tray */}
            {selectedCount > 0 && (
                <div className="fixed left-0 right-0 z-40 px-4" style={{ bottom: 'calc(var(--bottom-nav-height) + env(safe-area-inset-bottom) + 12px)' }}>
                    <div className="max-w-lg mx-auto flex items-center gap-2 rounded-2xl bg-foreground text-background p-2 pl-4 shadow-2xl">
                        <div className="flex -space-x-1.5">
                            {getSelectedArray().slice(0, 5).map((r) => (
                                <span key={r.id} className="w-5 h-5 rounded-full ring-2 ring-foreground" style={{ backgroundColor: r.color }} />
                            ))}
                        </div>
                        <span className="flex-1 text-14 font-semibold">{selectedCount} {selectedCount === 1 ? 'ruta' : 'rutas'} para comparar</span>
                        <button onClick={clearAll} className="h-9 px-3 rounded-xl text-13 font-medium opacity-70 hover:opacity-100">Limpiar</button>
                        <button onClick={compareOnMap} className="h-9 px-4 rounded-xl bg-background text-foreground text-14 font-bold active:scale-95 transition">Ver en el mapa</button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function ExplorarPage() {
    return (
        <Suspense fallback={null}>
            <ExplorarContent />
        </Suspense>
    );
}
