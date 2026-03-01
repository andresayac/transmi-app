'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { transmilenioApi } from '@/services/transmilenio';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { StationMapEntry } from '@/types/station';
import { RouteSearchResult } from '@/types/route';
import { ROUTE_COLORS } from '@/utils/constants';

function isActiveNow(horarios?: { data?: Array<{ convencion: string; hora_inicio: string; hora_fin: string }> }): boolean {
    if (!horarios?.data?.length) return false;
    const now = new Date();
    const hour = now.getHours();
    const min = now.getMinutes();
    const day = now.getDay(); // 0=Sun, 1=Mon ... 6=Sat

    return horarios.data.some(h => {
        const conv = h.convencion?.toUpperCase().trim() || '';

        // Check if this convention applies today
        let appliesToday = false;
        if (conv === 'L-S') {
            appliesToday = day >= 1 && day <= 6; // Mon-Sat
        } else if (conv === 'L-V') {
            appliesToday = day >= 1 && day <= 5; // Mon-Fri
        } else if (conv === 'S' || conv === 'SAB' || conv === 'SABADO' || conv === 'SÁBADO') {
            appliesToday = day === 6; // Saturday only
        } else if (conv === 'D-F' || conv === 'DOM' || conv === 'DOMINGO' || conv.includes('FESTIV')) {
            appliesToday = day === 0; // Sunday / holidays
        } else if (conv === 'D' || conv === 'DOM-FES') {
            appliesToday = day === 0;
        } else {
            // Unknown convention — check all days as fallback
            appliesToday = true;
        }

        if (!appliesToday) return false;

        const parseTime = (t: string) => {
            const match = t.match(/(\d+):(\d+)\s*(AM|PM)?/i);
            if (!match) return 0;
            let h = parseInt(match[1]);
            const m = parseInt(match[2]);
            const period = match[3]?.toUpperCase();
            if (period === 'PM' && h < 12) h += 12;
            if (period === 'AM' && h === 12) h = 0;
            return h * 60 + m;
        };

        const start = parseTime(h.hora_inicio);
        const end = parseTime(h.hora_fin);
        const nowMin = hour * 60 + min;
        return nowMin >= start && nowMin <= end;
    });
}

function formatHour(t: string): string {
    const match = t.match(/(\d+):(\d+)\s*(AM|PM)?/i);
    if (!match) return t;
    let h = parseInt(match[1]);
    const m = match[2];
    const period = match[3]?.toUpperCase();
    if (period === 'PM' && h < 12) h += 12;
    if (period === 'AM' && h === 12) h = 0;
    return `${h}:${m}`;
}

interface StationExplorerProps {
    station: StationMapEntry;
    onClose: () => void;
}

export default function StationExplorer({ station, onClose }: StationExplorerProps) {
    const router = useRouter();
    const [rutas, setRutas] = useState<RouteSearchResult[]>([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<Set<string>>(new Set());

    // Bottom sheet snap points
    type SnapPoint = 'collapsed' | 'half' | 'full';
    const [snap, setSnap] = useState<SnapPoint>('half');
    const [dragging, setDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState(0);
    const dragStartY = useRef(0);
    const dragStartHeight = useRef(0);
    const sheetRef = useRef<HTMLDivElement>(null);

    const getSnapHeights = useCallback(() => {
        const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
        return {
            collapsed: 120,
            half: vh * 0.45,
            full: vh * 0.85,
        };
    }, []);

    const currentHeight = getSnapHeights()[snap];

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setLoading(true);
            try {
                const data = await transmilenioApi.getRutasByEstacion(station.id);
                if (!cancelled) {
                    const unique = data.filter((r, i, arr) => arr.findIndex(x => x.id === r.id) === i);
                    setRutas(unique);
                }
            } catch {
                if (!cancelled) setRutas([]);
            }
            if (!cancelled) setLoading(false);
        };
        load();
        return () => { cancelled = true; };
    }, [station.id]);

    const toggleSelect = (id: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleViewBuses = () => {
        if (selected.size === 0) return;
        const selectedRoutes = rutas
            .filter((r) => selected.has(r.id))
            .map((r, i) => ({
                id: r.id,
                codigo: r.codigo,
                nombre: r.nombre,
                tipoServicio: r.tipoServicio,
                color: ROUTE_COLORS[i % ROUTE_COLORS.length],
                originalColor: r.color,
            }));
        sessionStorage.setItem('multiRoutes', JSON.stringify(selectedRoutes));
        router.push('/mapa?multi=true');
    };

    const handleViewSingle = (route: RouteSearchResult) => {
        const params = new URLSearchParams({ id: route.id, nombre: route.nombre, codigo: route.codigo });
        router.push(`/mapa?${params.toString()}`);
    };

    // Snap to nearest point based on height
    const snapTo = useCallback((height: number) => {
        const heights = getSnapHeights();
        // Don't allow closing by drag — minimum is collapsed
        const clampedHeight = Math.max(height, heights.collapsed);
        const points: [SnapPoint, number][] = [
            ['collapsed', heights.collapsed],
            ['half', heights.half],
            ['full', heights.full],
        ];
        let nearest: SnapPoint = 'half';
        let minDist = Infinity;
        for (const [name, h] of points) {
            const d = Math.abs(clampedHeight - h);
            if (d < minDist) { minDist = d; nearest = name; }
        }
        setSnap(nearest);
        setDragOffset(0);
    }, [getSnapHeights]);

    // Drag handlers
    const onDragStart = useCallback((clientY: number) => {
        setDragging(true);
        dragStartY.current = clientY;
        dragStartHeight.current = currentHeight + dragOffset;
    }, [currentHeight, dragOffset]);

    const onDragMove = useCallback((clientY: number) => {
        if (!dragging) return;
        const delta = dragStartY.current - clientY;
        const newHeight = dragStartHeight.current + delta;
        setDragOffset(newHeight - currentHeight);
    }, [dragging, currentHeight]);

    const onDragEnd = useCallback(() => {
        if (!dragging) return;
        setDragging(false);
        snapTo(currentHeight + dragOffset);
    }, [dragging, currentHeight, dragOffset, snapTo]);

    // Touch events
    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        onDragStart(e.touches[0].clientY);
    }, [onDragStart]);

    const handleTouchMove = useCallback((e: React.TouchEvent) => {
        onDragMove(e.touches[0].clientY);
    }, [onDragMove]);

    const handleTouchEnd = useCallback(() => {
        onDragEnd();
    }, [onDragEnd]);

    // Mouse events for desktop drag
    useEffect(() => {
        if (!dragging) return;
        const onMove = (e: MouseEvent) => onDragMove(e.clientY);
        const onUp = () => onDragEnd();
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        return () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
    }, [dragging, onDragMove, onDragEnd]);

    const displayHeight = Math.max(getSnapHeights().collapsed, currentHeight + dragOffset);

    return (
        <div className="absolute bottom-0 left-0 right-0 z-50" onClick={(e) => e.stopPropagation()}>
            <div
                ref={sheetRef}
                className="bg-card border-t border-border rounded-t-2xl overflow-hidden shadow-2xl pb-[env(safe-area-inset-bottom)]"
                style={{
                    height: `${displayHeight}px`,
                    transition: dragging ? 'none' : 'height 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
                }}
            >
                {/* Drag handle */}
                <div
                    className="flex justify-center pt-3 pb-1 cursor-grab active:cursor-grabbing touch-none select-none"
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    onMouseDown={(e) => onDragStart(e.clientY)}
                >
                    <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
                </div>

                {/* Header */}
                <div className="px-5 pb-3">
                    <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2.5 flex-1 min-w-0">
                            <div className="w-2 h-2 rounded-full shrink-0 bg-foreground" />
                            <h3 className="text-foreground font-semibold text-[15px] truncate">{station.nombre}</h3>
                        </div>
                        <div className="flex items-center gap-1 shrink-0 ml-2">
                            {snap === 'collapsed' ? (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setSnap('half')}
                                    className="h-7 w-7 rounded-md"
                                    title="Expandir"
                                >
                                    <svg className="w-3.5 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                                    </svg>
                                </Button>
                            ) : snap === 'full' ? (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setSnap('half')}
                                    className="h-7 w-7 rounded-md"
                                    title="Reducir"
                                >
                                    <svg className="w-3.5 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                    </svg>
                                </Button>
                            ) : null}
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={onClose}
                                className="h-7 w-7 rounded-md"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </Button>
                        </div>
                    </div>
                    {snap !== 'collapsed' && (
                        <>
                            <p className="text-muted-foreground text-[11px] mb-1.5">{station.direccion}</p>
                            <div className="flex items-center gap-2">
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-secondary text-muted-foreground">
                                    {station.sistema}
                                </span>
                                <span className="text-muted-foreground/50 text-[10px]">{station.codigo}</span>
                            </div>
                        </>
                    )}
                </div>

                {/* Selection bar */}
                {selected.size > 0 && snap !== 'collapsed' && (
                    <div className="px-5 pb-2 flex items-center gap-2">
                        <span className="text-muted-foreground text-[11px]">{selected.size} ruta{selected.size !== 1 ? 's' : ''}</span>
                        <button onClick={() => setSelected(new Set())} className="text-muted-foreground hover:text-foreground text-[11px] font-medium">
                            Limpiar
                        </button>
                        <div className="flex-1" />
                        <Button
                            onClick={handleViewBuses}
                            size="sm"
                            className="h-7 rounded-lg text-[11px] font-semibold px-3"
                        >
                            Ver buses ({selected.size})
                        </Button>
                    </div>
                )}

                {/* Separator */}
                {snap !== 'collapsed' && <div className="mx-5 border-t border-border" />}

                {/* Routes list */}
                {snap !== 'collapsed' && (
                    <div className="px-5 pb-6 pt-2 overflow-y-auto flex-1" style={{ maxHeight: `${displayHeight - 120}px` }}>
                        {loading ? (
                            <div className="space-y-2 py-2">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="flex items-center gap-3 py-2">
                                        <Skeleton className="w-5 h-5 rounded" />
                                        <Skeleton className="w-10 h-5 rounded" />
                                        <div className="flex-1">
                                            <Skeleton className="w-3/4 h-3 mb-1" />
                                            <Skeleton className="w-1/3 h-2.5" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : rutas.length === 0 ? (
                            <p className="text-muted-foreground text-center text-xs py-6">No se encontraron rutas</p>
                        ) : (
                            <>
                                <p className="text-muted-foreground/50 text-[11px] mb-2">{rutas.length} ruta{rutas.length !== 1 ? 's' : ''}</p>
                                <div className="space-y-0.5">
                                    {rutas.map((r) => {
                                        const isSelected = selected.has(r.id);
                                        return (
                                            <div
                                                key={r.id}
                                                className={`flex items-center gap-3 py-2.5 px-2 rounded-lg transition-colors ${isSelected
                                                    ? 'bg-accent'
                                                    : 'hover:bg-accent/50'
                                                    }`}
                                            >
                                                {/* Checkbox */}
                                                <button
                                                    onClick={() => toggleSelect(r.id)}
                                                    className={`w-4 h-4 rounded shrink-0 flex items-center justify-center border transition-colors ${isSelected
                                                        ? 'bg-foreground border-foreground'
                                                        : 'border-border'
                                                        }`}
                                                >
                                                    {isSelected && (
                                                        <svg className="w-2.5 h-2.5 text-background" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                        </svg>
                                                    )}
                                                </button>

                                                {/* Route info */}
                                                <button
                                                    onClick={() => handleViewSingle(r)}
                                                    className="flex items-center gap-2.5 flex-1 min-w-0 text-left active:opacity-70"
                                                >
                                                    <span
                                                        className="px-1.5 py-0.5 rounded text-white text-[10px] font-bold shrink-0"
                                                        style={{ backgroundColor: r.color || '#525252' }}
                                                    >
                                                        {r.codigo}
                                                    </span>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-1.5">
                                                            <p className="text-foreground text-xs font-medium truncate">{r.nombre}</p>
                                                            {r.horarios?.data && r.horarios.data.length > 0 && (
                                                                isActiveNow(r.horarios) ? (
                                                                    <span className="inline-flex items-center gap-0.5 shrink-0">
                                                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                                    </span>
                                                                ) : (
                                                                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                                                                )
                                                            )}
                                                        </div>
                                                        <p className="text-muted-foreground text-[10px]">
                                                            {r.tipoServicio}
                                                            {r.horarios?.data && r.horarios.data.length > 0 && (
                                                                <> · {r.horarios.data.map((h, i) => (
                                                                    <span key={i}>
                                                                        {i > 0 && ' · '}
                                                                        {h.convencion} {formatHour(h.hora_inicio)}–{formatHour(h.hora_fin)}
                                                                    </span>
                                                                ))}</>
                                                            )}
                                                        </p>
                                                    </div>
                                                </button>

                                                <svg className="w-3.5 h-3.5 text-muted-foreground/30 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                                </svg>
                                            </div>
                                        );
                                    })}
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
