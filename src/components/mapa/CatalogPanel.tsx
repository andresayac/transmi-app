'use client';

import { useState, useEffect, useMemo } from 'react';
import { transmilenioApi } from '@/services/transmilenio';
import { RouteCatalogEntry, RouteCatalog, CatalogProgress } from '@/types/catalog';
import { ROUTE_COLORS } from '@/utils/constants';

interface CatalogPanelProps {
    onSelectRoutes: (routes: Array<{ id: string; codigo: string; nombre: string; tipoServicio: string; color: string; originalColor: string }>) => void;
    onClose: () => void;
}

export default function CatalogPanel({ onSelectRoutes, onClose }: CatalogPanelProps) {
    const [catalog, setCatalog] = useState<RouteCatalog | null>(null);
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState<CatalogProgress | null>(null);
    const [search, setSearch] = useState('');
    const [filterTroncal, setFilterTroncal] = useState<string | null>(null);
    const [selected, setSelected] = useState<Set<string>>(new Set());

    // Try to load cached catalog on mount
    useEffect(() => {
        const cached = transmilenioApi.getRouteCatalog();
        if (cached) setCatalog(cached);
    }, []);

    const loadCatalog = async (force = false) => {
        setLoading(true);
        setProgress(null);
        try {
            const result = await transmilenioApi.getAllRouteCatalog(
                (p) => setProgress(p),
                force,
            );
            setCatalog(result);
        } catch {
            // error handled silently
        }
        setLoading(false);
        setProgress(null);
    };

    // Get unique troncales for filter
    const troncales = useMemo(() => {
        if (!catalog) return [];
        const map = new Map<string, { id: string; nombre: string; letra: string; color: string }>();
        for (const e of catalog.entries) {
            if (!map.has(e.troncalId)) {
                map.set(e.troncalId, {
                    id: e.troncalId,
                    nombre: e.troncalNombre,
                    letra: e.troncalLetra,
                    color: e.troncalColor,
                });
            }
        }
        return Array.from(map.values());
    }, [catalog]);

    // Filtered entries
    const filtered = useMemo(() => {
        if (!catalog) return [];
        let entries = catalog.entries;
        if (filterTroncal) {
            entries = entries.filter((e) => e.troncalId === filterTroncal);
        }
        if (search.trim()) {
            const q = search.toLowerCase();
            entries = entries.filter(
                (e) =>
                    e.codigo.toLowerCase().includes(q) ||
                    e.nombre.toLowerCase().includes(q),
            );
        }
        return entries.sort((a, b) => a.codigo.localeCompare(b.codigo));
    }, [catalog, filterTroncal, search]);

    const toggleSelect = (id: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleViewSelected = () => {
        if (!catalog || selected.size === 0) return;
        const selectedEntries = catalog.entries.filter((e) => selected.has(e.id));
        const routes = selectedEntries.map((e, i) => ({
            id: e.id,
            codigo: e.codigo,
            nombre: e.nombre,
            tipoServicio: e.tipoServicio,
            color: ROUTE_COLORS[i % ROUTE_COLORS.length],
            originalColor: e.color,
        }));
        onSelectRoutes(routes);
    };

    const progressPercent = progress
        ? Math.round((progress.loaded / Math.max(progress.total, 1)) * 100)
        : 0;

    // ─── No catalog loaded ───────────────────────────────
    if (!catalog && !loading) {
        return (
            <div className="absolute inset-0 z-50 flex items-end justify-center" onClick={onClose}>
                <div
                    className="w-full max-w-md glass rounded-t-3xl p-6 pb-8 animate-slide-up"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="flex justify-center mb-4">
                        <div className="w-10 h-1 rounded-full bg-white/20" />
                    </div>
                    <div className="text-center">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-blue-500/15 flex items-center justify-center">
                            <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
                            </svg>
                        </div>
                        <h3 className="text-white font-bold text-lg mb-1">Catálogo de Rutas</h3>
                        <p className="text-white/50 text-sm mb-6">
                            Carga todas las rutas del sistema para buscar y seleccionar rápidamente
                        </p>
                        <button
                            onClick={() => loadCatalog()}
                            className="w-full py-3.5 rounded-2xl bg-blue-500 text-white font-bold text-sm active:scale-95 transition-transform shadow-lg shadow-blue-500/25"
                        >
                            Cargar catálogo completo
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ─── Loading state ───────────────────────────────────
    if (loading) {
        return (
            <div className="absolute inset-0 z-50 flex items-end justify-center">
                <div className="w-full max-w-md glass rounded-t-3xl p-6 pb-8 animate-slide-up">
                    <div className="flex justify-center mb-4">
                        <div className="w-10 h-1 rounded-full bg-white/20" />
                    </div>
                    <div className="text-center">
                        <div className="w-12 h-12 mx-auto mb-4 border-3 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                        <h3 className="text-white font-bold text-base mb-2">Cargando catálogo...</h3>
                        {progress && (
                            <>
                                <p className="text-white/50 text-sm mb-3">{progress.label}</p>
                                {/* Progress bar */}
                                <div className="w-full bg-white/10 rounded-full h-2 mb-2 overflow-hidden">
                                    <div
                                        className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-300"
                                        style={{ width: `${progressPercent}%` }}
                                    />
                                </div>
                                <p className="text-white/30 text-xs">
                                    {progress.phase === 'troncales' && 'Obteniendo troncales...'}
                                    {progress.phase === 'estaciones' && `Estaciones ${progress.loaded}/${progress.total}`}
                                    {progress.phase === 'rutas' && `Estaciones procesadas ${progress.loaded}/${progress.total}`}
                                </p>
                            </>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // ─── Catalog loaded ──────────────────────────────────
    return (
        <div className="absolute inset-0 z-50 flex flex-col bg-black/60" onClick={onClose}>
            <div
                className="mt-auto w-full glass rounded-t-3xl flex flex-col overflow-hidden animate-slide-up"
                style={{ maxHeight: '85vh' }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Handle + Header */}
                <div className="flex-shrink-0 px-5 pt-3 pb-2">
                    <div className="flex justify-center mb-3">
                        <div className="w-10 h-1 rounded-full bg-white/20" />
                    </div>

                    <div className="flex items-center justify-between mb-3">
                        <div>
                            <h3 className="text-white font-bold text-base">Catálogo de Rutas</h3>
                            <p className="text-white/40 text-xs">
                                {catalog!.entries.length} rutas · {catalog!.troncalCount} troncales · {catalog!.estacionCount} estaciones
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => loadCatalog(true)}
                                className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center active:scale-90 transition-transform"
                                title="Refrescar catálogo"
                            >
                                <svg className="w-4 h-4 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M2.985 19.644l3.181-3.182" />
                                </svg>
                            </button>
                            <button
                                onClick={onClose}
                                className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center active:scale-90 transition-transform"
                            >
                                <svg className="w-4 h-4 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    {/* Search */}
                    <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 mb-3">
                        <svg className="w-4 h-4 text-white/40 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                            type="text"
                            placeholder="Buscar ruta (ej: E44, Portal Norte)..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="flex-1 bg-transparent outline-none text-white text-sm placeholder:text-white/30"
                        />
                        {search && (
                            <button onClick={() => setSearch('')} className="text-white/40 text-xs">✕</button>
                        )}
                    </div>

                    {/* Troncal filter chips */}
                    <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-hide">
                        <button
                            onClick={() => setFilterTroncal(null)}
                            className={`flex-shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${!filterTroncal
                                ? 'bg-blue-500 text-white'
                                : 'bg-white/5 text-white/50'
                                }`}
                        >
                            Todas
                        </button>
                        {troncales.map((t) => (
                            <button
                                key={t.id}
                                onClick={() => setFilterTroncal(filterTroncal === t.id ? null : t.id)}
                                className={`flex-shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all flex items-center gap-1 ${filterTroncal === t.id
                                    ? 'text-white'
                                    : 'bg-white/5 text-white/50'
                                    }`}
                                style={filterTroncal === t.id ? { backgroundColor: t.color } : {}}
                            >
                                <span
                                    className="w-2 h-2 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: t.color }}
                                />
                                {t.letra}
                            </button>
                        ))}
                    </div>

                    {/* Selection bar */}
                    {selected.size > 0 && (
                        <div className="flex items-center gap-2 mt-1 mb-1">
                            <span className="text-white/50 text-[11px]">{selected.size} seleccionada{selected.size !== 1 ? 's' : ''}</span>
                            <button
                                onClick={() => setSelected(new Set())}
                                className="text-red-400/80 text-[11px] font-semibold"
                            >
                                Limpiar
                            </button>
                            <div className="flex-1" />
                            <button
                                onClick={handleViewSelected}
                                className="px-4 py-1.5 rounded-xl bg-blue-500 text-white text-xs font-bold active:scale-95 transition-transform shadow-lg shadow-blue-500/20"
                            >
                                Ver en mapa ({selected.size})
                            </button>
                        </div>
                    )}
                </div>

                {/* Results count */}
                <div className="flex-shrink-0 px-5 pb-2">
                    <p className="text-white/30 text-[11px]">{filtered.length} rutas</p>
                </div>

                {/* Route list */}
                <div className="flex-1 overflow-y-auto px-5 pb-6 space-y-1.5">
                    {filtered.map((entry) => {
                        const isSelected = selected.has(entry.id);
                        return (
                            <button
                                key={entry.id}
                                onClick={() => toggleSelect(entry.id)}
                                className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all active:scale-[0.98] text-left ${isSelected
                                    ? 'bg-blue-500/15 border border-blue-500/30'
                                    : 'bg-white/[0.03] border border-transparent hover:bg-white/[0.06]'
                                    }`}
                            >
                                {/* Checkbox */}
                                <div className={`w-5 h-5 rounded-md flex-shrink-0 flex items-center justify-center border-2 transition-colors ${isSelected
                                    ? 'bg-blue-500 border-blue-500'
                                    : 'border-white/20'
                                    }`}>
                                    {isSelected && (
                                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                        </svg>
                                    )}
                                </div>

                                {/* Route badge */}
                                <span
                                    className="px-2 py-0.5 rounded-lg text-white text-[11px] font-bold flex-shrink-0"
                                    style={{ backgroundColor: entry.color || '#6b7280' }}
                                >
                                    {entry.codigo}
                                </span>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <p className="text-white text-xs font-semibold truncate">{entry.nombre}</p>
                                    <p className="text-white/30 text-[10px] truncate">
                                        {entry.tipoServicio} · {entry.troncalNombre}
                                    </p>
                                </div>

                                {/* Troncal dot */}
                                <span
                                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: entry.troncalColor }}
                                />
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
