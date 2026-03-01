'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import AppHeader from '@/components/layout/AppHeader';
import { transmilenioApi } from '@/services/transmilenio';
import { useToast } from '@/components/ui/Toast';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Troncal, Estacion, ZonaOperacional, Parada, BusETA } from '@/types/explorar';
import { RouteSearchResult } from '@/types/route';

type Tab = 'troncales' | 'zonas' | 'paradas';

type DrillLevel =
    | { type: 'list' }
    | { type: 'estaciones'; troncal: Troncal }
    | { type: 'rutas_estacion'; estacion: Estacion; parentName: string; parentColor: string }
    | { type: 'rutas_zona'; zona: ZonaOperacional }
    | { type: 'rutas_parada'; parada: Parada };

export default function ExplorarPage() {
    const router = useRouter();
    const toast = useToast();
    const [activeTab, setActiveTab] = useState<Tab>('troncales');
    const [drill, setDrill] = useState<DrillLevel>({ type: 'list' });

    const [troncales, setTroncales] = useState<Troncal[]>([]);
    const [estaciones, setEstaciones] = useState<Estacion[]>([]);
    const [zonas, setZonas] = useState<ZonaOperacional[]>([]);
    const [paradas, setParadas] = useState<Parada[]>([]);
    const [rutas, setRutas] = useState<RouteSearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [paradaSearch, setParadaSearch] = useState('');
    const debounceRef = useRef<NodeJS.Timeout | null>(null);

    const [etaMap, setEtaMap] = useState<Record<string, BusETA[]>>({});
    const [etaLoading, setEtaLoading] = useState(false);

    useEffect(() => { loadTroncales(); }, []);

    useEffect(() => {
        if (drill.type === 'rutas_estacion' && rutas.length > 0 && drill.estacion?.codigo) {
            fetchETAForStation(drill.estacion.codigo, rutas);
        }
        if (drill.type === 'rutas_parada' && rutas.length > 0 && drill.parada?.codigo) {
            fetchETAForStation(drill.parada.codigo, rutas);
        }
    }, [drill, rutas]);

    const fetchETAForStation = async (estacionCodigo: string, routes: RouteSearchResult[]) => {
        setEtaLoading(true);
        const newEtaMap: Record<string, BusETA[]> = {};
        const subset = routes.slice(0, 5);
        await Promise.allSettled(
            subset.map(async (r) => {
                try {
                    const etas = await transmilenioApi.getServicios(estacionCodigo, r.codigo, r.id, r.nombre);
                    if (etas.length > 0) newEtaMap[r.id] = etas;
                } catch { /* ignore */ }
            })
        );
        setEtaMap(newEtaMap);
        setEtaLoading(false);
    };

    const loadTroncales = async () => {
        setLoading(true);
        try { setTroncales(await transmilenioApi.getTroncales()); }
        catch { toast.show('Error cargando troncales', 'error'); }
        setLoading(false);
    };

    const loadZonas = async () => {
        setLoading(true);
        try { setZonas(await transmilenioApi.getZonas()); }
        catch { toast.show('Error cargando zonas', 'error'); }
        setLoading(false);
    };

    const loadEstaciones = async (troncal: Troncal) => {
        setLoading(true);
        setDrill({ type: 'estaciones', troncal });
        setEtaMap({});
        try { setEstaciones(await transmilenioApi.getEstacionesByTroncal(troncal.id)); }
        catch { toast.show('Error cargando estaciones', 'error'); }
        setLoading(false);
    };

    const loadRutasByEstacion = async (estacion: Estacion, parentName: string, parentColor: string) => {
        setLoading(true);
        setDrill({ type: 'rutas_estacion', estacion, parentName, parentColor });
        setEtaMap({});
        try {
            const data = await transmilenioApi.getRutasByEstacion(estacion.id);
            setRutas(data.filter((r, i, arr) => arr.findIndex(x => x.id === r.id) === i));
        } catch { toast.show('Error cargando rutas', 'error'); }
        setLoading(false);
    };

    const loadRutasByZona = async (zona: ZonaOperacional) => {
        setLoading(true);
        setDrill({ type: 'rutas_zona', zona });
        setEtaMap({});
        try { setRutas(await transmilenioApi.getRutasByZona(zona.id)); }
        catch { toast.show('Error cargando rutas', 'error'); }
        setLoading(false);
    };

    const searchParadas = useCallback(async (term: string) => {
        if (!term.trim()) { setParadas([]); return; }
        setLoading(true);
        try { setParadas(await transmilenioApi.searchParadas(term)); }
        catch { toast.show('Error buscando paradas', 'error'); }
        setLoading(false);
    }, [toast]);

    const loadRutasByParada = async (parada: Parada) => {
        setLoading(true);
        setDrill({ type: 'rutas_parada', parada });
        setEtaMap({});
        try {
            const data = await transmilenioApi.getRutasByEstacion(parada.id);
            setRutas(data.filter((r, i, arr) => arr.findIndex(x => x.id === r.id) === i));
        } catch { toast.show('Error cargando rutas', 'error'); }
        setLoading(false);
    };

    const handleTabChange = (tab: Tab) => {
        setActiveTab(tab);
        setDrill({ type: 'list' });
        setRutas([]);
        setEtaMap({});
        if (tab === 'zonas' && zonas.length === 0) loadZonas();
        if (tab === 'paradas') { setParadas([]); setParadaSearch(''); }
    };

    const goBack = () => {
        if (drill.type === 'rutas_estacion' && drill.parentName) {
            const troncal = troncales.find(t => t.nombre === drill.parentName);
            if (troncal) { loadEstaciones(troncal); return; }
        }
        setDrill({ type: 'list' });
        setRutas([]);
        setEtaMap({});
    };

    const handleSelectRoute = (route: RouteSearchResult) => {
        const params = new URLSearchParams({ id: route.id, nombre: route.nombre, codigo: route.codigo });
        router.push(`/mapa?${params.toString()}`);
    };

    const getStatusColor = (estado: string) => {
        const s = estado?.toLowerCase() || '';
        if (s.includes('vacio') || s.includes('vacío')) return 'text-emerald-400';
        if (s.includes('medio')) return 'text-yellow-400';
        if (s.includes('lleno')) return 'text-red-400';
        return 'text-muted-foreground';
    };

    const getTitle = () => {
        switch (drill.type) {
            case 'estaciones': return drill.troncal.nombre;
            case 'rutas_estacion': return drill.estacion.nombre;
            case 'rutas_zona': return drill.zona.nombre;
            case 'rutas_parada': return drill.parada.nombre;
            default: return 'Explorar';
        }
    };

    const tabs: { key: Tab; label: string }[] = [
        { key: 'troncales', label: 'Troncales' },
        { key: 'zonas', label: 'Zonas' },
        { key: 'paradas', label: 'Paradas' },
    ];

    return (
        <div className="safe-bottom">
            <AppHeader />

            {/* Title + Back */}
            <div className="px-4 pt-4 pb-2">
                <div className="flex items-center gap-3">
                    {drill.type !== 'list' && (
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={goBack}
                            className="h-8 w-8 rounded-lg"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                            </svg>
                        </Button>
                    )}
                    <div>
                        <h2 className="text-lg font-semibold text-foreground">{getTitle()}</h2>
                        {drill.type === 'estaciones' && (
                            <p className="text-xs text-muted-foreground">
                                {estaciones.length} estaciones · Troncal {drill.troncal.letra}
                            </p>
                        )}
                        {(drill.type === 'rutas_estacion' || drill.type === 'rutas_zona' || drill.type === 'rutas_parada') && (
                            <p className="text-xs text-muted-foreground">
                                {rutas.length} ruta{rutas.length !== 1 ? 's' : ''}
                                {etaLoading && ' · Cargando ETA...'}
                                {!etaLoading && Object.keys(etaMap).length > 0 && ' · ETA disponible'}
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* Tabs — small text, no icons, underline style */}
            {drill.type === 'list' && (
                <div className="px-4 pb-3">
                    <div className="flex border-b border-border">
                        {tabs.map(t => (
                            <button
                                key={t.key}
                                onClick={() => handleTabChange(t.key)}
                                className={`flex-1 pb-2.5 text-[13px] font-medium transition-colors relative ${activeTab === t.key
                                    ? 'text-foreground'
                                    : 'text-muted-foreground hover:text-foreground/70'
                                    }`}
                            >
                                {t.label}
                                {activeTab === t.key && (
                                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-[2px] bg-foreground rounded-full" />
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Search bar for Paradas */}
            {drill.type === 'list' && activeTab === 'paradas' && (
                <div className="px-4 pb-3">
                    <div className="relative">
                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <Input
                            type="text"
                            placeholder="Buscar parada o estación..."
                            value={paradaSearch}
                            onChange={(e) => {
                                const val = e.target.value;
                                setParadaSearch(val);
                                if (debounceRef.current) clearTimeout(debounceRef.current);
                                if (val.length >= 2) {
                                    debounceRef.current = setTimeout(() => searchParadas(val), 400);
                                } else setParadas([]);
                            }}
                            className="pl-9 h-9 rounded-lg"
                        />
                        {paradaSearch && (
                            <button
                                onClick={() => { setParadaSearch(''); setParadas([]); }}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Loading skeletons */}
            {loading && (
                <div className="px-4 space-y-1">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <div key={i} className="flex items-center gap-3 py-3 px-1">
                            <Skeleton className="w-8 h-8 rounded-lg" />
                            <div className="flex-1">
                                <Skeleton className="w-2/3 h-3.5 mb-1.5" />
                                <Skeleton className="w-1/3 h-2.5" />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Troncales list */}
            {!loading && drill.type === 'list' && activeTab === 'troncales' && (
                <div className="px-4 pb-4">
                    {troncales.map((t, i) => (
                        <button
                            key={t.id}
                            onClick={() => loadEstaciones(t)}
                            className="w-full flex items-center gap-3 py-3 px-1 border-b border-border last:border-0 hover:bg-accent/50 active:bg-accent transition-colors text-left"
                            style={{ animationDelay: `${i * 0.03}s` }}
                        >
                            <div
                                className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
                                style={{ backgroundColor: t.color }}
                            >
                                {t.letra}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="text-[13px] font-medium text-foreground">{t.nombre}</h3>
                                <p className="text-[11px] text-muted-foreground">Troncal {t.letra}</p>
                            </div>
                            <svg className="w-4 h-4 text-muted-foreground/40 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                    ))}
                </div>
            )}

            {/* Estaciones list */}
            {!loading && drill.type === 'estaciones' && (
                <div className="px-4 pb-4">
                    {estaciones.map((e, i) => (
                        <button
                            key={e.id}
                            onClick={() => loadRutasByEstacion(e, drill.troncal.nombre, drill.troncal.color)}
                            className="w-full flex items-center gap-3 py-3 px-1 border-b border-border last:border-0 hover:bg-accent/50 active:bg-accent transition-colors text-left"
                            style={{ animationDelay: `${i * 0.03}s` }}
                        >
                            <div
                                className="w-7 h-7 rounded-md flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                                style={{ backgroundColor: drill.troncal.color }}
                            >
                                {e.codigo.replace('TM', '')}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="text-[13px] font-medium text-foreground leading-snug">{e.nombre}</h3>
                                <p className="text-[11px] text-muted-foreground truncate">{e.direccion}</p>
                            </div>
                            <svg className="w-4 h-4 text-muted-foreground/40 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                    ))}
                </div>
            )}

            {/* Zonas grid */}
            {!loading && drill.type === 'list' && activeTab === 'zonas' && (
                <div className="px-4 pb-4">
                    {zonas.map((z, i) => (
                        <button
                            key={z.id}
                            onClick={() => loadRutasByZona(z)}
                            className="w-full flex items-center justify-between py-3 px-1 border-b border-border last:border-0 hover:bg-accent/50 active:bg-accent transition-colors text-left"
                            style={{ animationDelay: `${i * 0.03}s` }}
                        >
                            <h3 className="text-[13px] font-medium text-foreground">{z.nombre}</h3>
                            <span className="text-[11px] text-muted-foreground">{z.cantiad} rutas</span>
                        </button>
                    ))}
                </div>
            )}

            {/* Paradas results */}
            {!loading && drill.type === 'list' && activeTab === 'paradas' && paradas.length > 0 && (
                <div className="px-4 pb-4">
                    <p className="text-[11px] text-muted-foreground font-medium mb-2 px-1">
                        {paradas.length} resultado{paradas.length !== 1 ? 's' : ''}
                    </p>
                    {paradas.map((p, i) => (
                        <button
                            key={p.id}
                            onClick={() => loadRutasByParada(p)}
                            className="w-full flex items-center gap-3 py-3 px-1 border-b border-border last:border-0 hover:bg-accent/50 active:bg-accent transition-colors text-left"
                            style={{ animationDelay: `${i * 0.03}s` }}
                        >
                            <div className={`w-7 h-7 rounded-md flex items-center justify-center text-white text-[9px] font-bold shrink-0 ${p.sistema === 'TransMilenio' ? 'bg-neutral-700' : 'bg-neutral-500'}`}>
                                {p.codigo.substring(0, 4)}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="text-[13px] font-medium text-foreground leading-snug">{p.nombre}</h3>
                                <p className="text-[11px] text-muted-foreground truncate">{p.direccion} · {p.sistema}</p>
                            </div>
                            <svg className="w-4 h-4 text-muted-foreground/40 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                    ))}
                </div>
            )}

            {/* Paradas empty state */}
            {!loading && drill.type === 'list' && activeTab === 'paradas' && paradas.length === 0 && (
                <div className="px-4 pt-12 text-center">
                    <svg className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                    </svg>
                    <p className="text-foreground text-sm font-medium mb-1">Busca una parada</p>
                    <p className="text-muted-foreground text-xs max-w-[200px] mx-auto">
                        Escribe el nombre para ver las rutas que pasan por ella
                    </p>
                </div>
            )}

            {/* Routes drill-down */}
            {!loading && (drill.type === 'rutas_estacion' || drill.type === 'rutas_zona' || drill.type === 'rutas_parada') && (
                <div className="px-4 pb-4">
                    {rutas.length === 0 ? (
                        <div className="text-center py-8">
                            <p className="text-muted-foreground text-sm">No se encontraron rutas</p>
                        </div>
                    ) : (
                        rutas.map((r, i) => {
                            const etas = etaMap[r.id] || [];
                            return (
                                <button
                                    key={`${r.id}-${i}`}
                                    onClick={() => handleSelectRoute(r)}
                                    className="w-full py-3 px-1 border-b border-border last:border-0 hover:bg-accent/50 active:bg-accent transition-colors text-left"
                                    style={{ animationDelay: `${i * 0.03}s` }}
                                >
                                    <div className="flex items-center gap-3 mb-1">
                                        <span
                                            className="px-2 py-1 rounded-md text-white font-bold text-[11px]"
                                            style={{ backgroundColor: r.color || '#525252' }}
                                        >
                                            {r.codigo}
                                        </span>
                                        <span className="text-[11px] text-muted-foreground">{r.tipoServicio}</span>
                                    </div>
                                    <h3 className="text-[13px] font-medium text-foreground mb-1">{r.nombre}</h3>

                                    {etas.length > 0 && (
                                        <div className="space-y-1 mt-1.5">
                                            {etas.slice(0, 2).map((eta, j) => (
                                                <div key={j} className="flex items-center gap-2 text-[11px]">
                                                    <span className={`font-medium ${getStatusColor(eta.estadobus)}`}>{eta.estadobus}</span>
                                                    <span className="text-foreground font-semibold">{eta.labeltiempo || `${eta.time} min`}</span>
                                                    <span className="text-muted-foreground">{eta.etiqueta}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {r.horarios?.data && (
                                        <div className="flex flex-wrap gap-1 mt-1.5">
                                            {r.horarios.data.map((h, j) => (
                                                <span key={j} className="px-1.5 py-0.5 rounded bg-secondary text-muted-foreground text-[10px]">
                                                    {h.convencion}: {h.hora_inicio} - {h.hora_fin}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </button>
                            );
                        })
                    )}
                </div>
            )}
        </div>
    );
}
