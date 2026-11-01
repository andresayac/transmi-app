'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, Library, Loader2, RefreshCw, Search, X } from 'lucide-react';
import { transmilenioApi } from '@/services/transmilenio';
import type { RouteCatalog, CatalogProgress } from '@/types/catalog';
import { ROUTE_COLORS } from '@/utils/constants';
import RouteBadge from '@/components/transit/RouteBadge';
import { readableOn } from '@/lib/color';
import { cn } from '@/lib/utils';
import type { StoredMultiRoute } from './types';

interface CatalogPanelProps {
    onSelectRoutes: (routes: StoredMultiRoute[]) => void;
    onClose: () => void;
}

/** Full system catalog: load every troncal route once, filter, pick several to compare on the map. */
export default function CatalogPanel({ onSelectRoutes, onClose }: CatalogPanelProps) {
    const [catalog, setCatalog] = useState<RouteCatalog | null>(() => (typeof window === 'undefined' ? null : transmilenioApi.getRouteCatalog()));
    const [loading, setLoading] = useState(false);
    const [failed, setFailed] = useState(false);
    const [progress, setProgress] = useState<CatalogProgress | null>(null);
    const [search, setSearch] = useState('');
    const [filterTroncal, setFilterTroncal] = useState<string | null>(null);
    const [selected, setSelected] = useState<Set<string>>(new Set());

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    const loadCatalog = async (force = false) => {
        setLoading(true);
        setFailed(false);
        setProgress(null);
        try {
            setCatalog(await transmilenioApi.getAllRouteCatalog((p) => setProgress(p), force));
        } catch {
            setFailed(true);
        }
        setLoading(false);
        setProgress(null);
    };

    const troncales = useMemo(() => {
        if (!catalog) return [];
        const map = new Map<string, { id: string; nombre: string; letra: string; color: string }>();
        for (const e of catalog.entries) {
            if (!map.has(e.troncalId)) map.set(e.troncalId, { id: e.troncalId, nombre: e.troncalNombre, letra: e.troncalLetra, color: e.troncalColor });
        }
        return Array.from(map.values()).sort((a, b) => a.letra.localeCompare(b.letra));
    }, [catalog]);

    const filtered = useMemo(() => {
        if (!catalog) return [];
        let entries = catalog.entries;
        if (filterTroncal) entries = entries.filter((e) => e.troncalId === filterTroncal);
        const q = search.trim().toLowerCase();
        if (q) entries = entries.filter((e) => e.codigo.toLowerCase().includes(q) || e.nombre.toLowerCase().includes(q));
        return [...entries].sort((a, b) => a.codigo.localeCompare(b.codigo, 'es', { numeric: true }));
    }, [catalog, filterTroncal, search]);

    const toggle = (id: string) => setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
    });

    const viewSelected = () => {
        if (!catalog || selected.size === 0) return;
        onSelectRoutes(catalog.entries.filter((e) => selected.has(e.id)).map((e, i) => ({
            id: e.id,
            codigo: e.codigo,
            nombre: e.nombre,
            tipoServicio: e.tipoServicio,
            color: ROUTE_COLORS[i % ROUTE_COLORS.length],
            originalColor: e.color,
        })));
    };

    const pct = progress ? Math.round((progress.loaded / Math.max(progress.total, 1)) * 100) : 0;

    return (
        <div className="absolute inset-0 z-50 flex flex-col justify-end bg-black/55 lg:justify-center lg:p-8" onClick={onClose} role="dialog" aria-modal="true" aria-label="Catálogo de rutas">
            <div
                className="w-full max-w-lg mx-auto bg-background rounded-t-[22px] border-t border-border flex flex-col overflow-hidden animate-slide-up shadow-2xl lg:rounded-[22px] lg:border"
                style={{ maxHeight: '88dvh' }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="shrink-0 px-4 pt-4 pb-3">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <h2 className="font-signage text-24 font-bold leading-tight">Catálogo de rutas</h2>
                            <p className="text-13 text-muted-foreground tabular">
                                {catalog
                                    ? `${catalog.entries.length} rutas · ${catalog.troncalCount} troncales · ${catalog.estacionCount} estaciones`
                                    : 'Todas las rutas troncales en un solo lugar'}
                            </p>
                        </div>
                        <div className="flex items-center gap-1">
                            {catalog && !loading && (
                                <button onClick={() => loadCatalog(true)} className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-accent" aria-label="Actualizar catálogo">
                                    <RefreshCw className="w-4 h-4" />
                                </button>
                            )}
                            <button onClick={onClose} className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-accent" aria-label="Cerrar catálogo">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Not loaded yet */}
                {!catalog && !loading && (
                    <div className="px-4 pb-[calc(env(safe-area-inset-bottom)+24px)] text-center">
                        <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-secondary flex items-center justify-center">
                            <Library className="w-7 h-7" />
                        </div>
                        <p className="text-14 text-muted-foreground mb-5 max-w-xs mx-auto">
                            Descarga una vez todas las rutas de todas las troncales para buscarlas y compararlas sin esperar. Toma alrededor de un minuto.
                        </p>
                        {failed && <p className="text-13 text-destructive mb-3">No se pudo descargar el catálogo. Revisa tu conexión e inténtalo de nuevo.</p>}
                        <button onClick={() => loadCatalog()} className="w-full h-12 rounded-full bg-foreground text-background text-15 font-semibold active:scale-[0.98] transition">
                            Descargar catálogo
                        </button>
                    </div>
                )}

                {/* Loading */}
                {loading && (
                    <div className="px-4 pb-[calc(env(safe-area-inset-bottom)+24px)] text-center" role="status">
                        <Loader2 className="w-8 h-8 mx-auto mb-3 animate-spin" />
                        <p className="text-15 font-semibold">Descargando catálogo…</p>
                        {progress && (
                            <>
                                <p className="text-13 text-muted-foreground mt-1 truncate">{progress.label}</p>
                                <div className="mt-3 h-2 w-full rounded-full bg-secondary overflow-hidden">
                                    <div className="h-full rounded-full system-stripe transition-[width] duration-300" style={{ width: `${pct}%` }} />
                                </div>
                                <p className="text-12 text-muted-foreground mt-1.5 tabular">
                                    {progress.phase === 'troncales' && 'Leyendo troncales'}
                                    {progress.phase === 'estaciones' && `Estaciones de ${progress.loaded} de ${progress.total} troncales`}
                                    {progress.phase === 'rutas' && `${progress.loaded} de ${progress.total} estaciones revisadas`}
                                </p>
                            </>
                        )}
                    </div>
                )}

                {/* Loaded */}
                {catalog && !loading && (
                    <>
                        <div className="shrink-0 px-4 space-y-3 pb-2">
                            <label className="relative block">
                                <span className="sr-only">Buscar ruta</span>
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                                <input
                                    type="search"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Código o destino, ej. E44 o Portal Norte"
                                    className="w-full h-11 pl-10 pr-3 rounded-full bg-secondary text-15 placeholder:text-muted-foreground border border-transparent focus:border-ring focus:outline-none"
                                />
                            </label>
                            <div className="flex gap-1.5 overflow-x-auto scrollbar-hidden -mx-4 px-4">
                                <button
                                    onClick={() => setFilterTroncal(null)}
                                    className={cn('h-8 px-3.5 rounded-full text-13 font-semibold shrink-0', !filterTroncal ? 'bg-foreground text-background' : 'bg-secondary text-muted-foreground')}
                                >
                                    Todas
                                </button>
                                {troncales.map((t) => {
                                    const active = filterTroncal === t.id;
                                    return (
                                        <button
                                            key={t.id}
                                            onClick={() => setFilterTroncal(active ? null : t.id)}
                                            title={t.nombre}
                                            aria-pressed={active}
                                            className={cn('h-8 min-w-8 px-2.5 rounded-full text-14 font-bold font-signage shrink-0 flex items-center gap-1.5', !active && 'bg-secondary text-foreground')}
                                            style={active ? { backgroundColor: t.color, color: readableOn(t.color) } : undefined}
                                        >
                                            {!active && <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.color }} />}
                                            {t.letra}
                                        </button>
                                    );
                                })}
                            </div>
                            <p className="text-12 text-muted-foreground tabular">{filtered.length} rutas</p>
                        </div>

                        <ul className="flex-1 overflow-y-auto px-2 pb-4">
                            {filtered.map((e) => {
                                const checked = selected.has(e.id);
                                return (
                                    <li key={e.id}>
                                        <button
                                            onClick={() => toggle(e.id)}
                                            role="checkbox"
                                            aria-checked={checked}
                                            className={cn('w-full flex items-center gap-3 px-2 py-2 rounded-xl text-left transition', checked ? 'bg-accent' : 'hover:bg-accent/60')}
                                        >
                                            <span className={cn('w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0', checked ? 'bg-foreground border-foreground' : 'border-muted-foreground/50')}>
                                                {checked && <Check className="w-3.5 h-3.5 text-background" strokeWidth={3} />}
                                            </span>
                                            <RouteBadge code={e.codigo} color={e.color} size="md" />
                                            <span className="flex-1 min-w-0">
                                                <span className="block font-signage text-17 font-semibold truncate">{e.nombre}</span>
                                                <span className="block text-12 text-muted-foreground truncate">Troncal {e.troncalLetra} · {e.troncalNombre}</span>
                                            </span>
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>

                        {selected.size > 0 && (
                            <div className="shrink-0 px-4 pt-2 pb-[calc(env(safe-area-inset-bottom)+12px)] border-t border-border flex items-center gap-3">
                                <button onClick={() => setSelected(new Set())} className="h-12 px-4 rounded-full text-14 font-semibold hover:bg-accent">
                                    Limpiar
                                </button>
                                <button onClick={viewSelected} className="flex-1 h-12 rounded-full bg-foreground text-background text-15 font-semibold active:scale-[0.98] transition">
                                    Ver {selected.size} en el mapa
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
