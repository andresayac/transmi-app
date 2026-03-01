'use client';

import React from 'react';

import { RouteSearchResult } from '@/types/route';
import { ROUTE_TYPE_ICONS } from '@/utils/constants';

interface RouteCardProps {
    route: RouteSearchResult;
    index: number;
    isFavorite: boolean;
    isSelected?: boolean;
    selectionColor?: string;
    onSelect: (route: RouteSearchResult) => void;
    onToggleFavorite: (route: RouteSearchResult) => void;
    onShare: (route: RouteSearchResult) => void;
    onToggleSelect?: (route: RouteSearchResult) => void;
}

// Check if current time is within a schedule range
function isActiveNow(horarios?: { data?: Array<{ convencion: string; hora_inicio: string; hora_fin: string }> }): boolean {
    if (!horarios?.data?.length) return false;
    const now = new Date();
    const currentHour = now.getHours();
    const currentMin = now.getMinutes();
    const day = now.getDay(); // 0=Sun, 1=Mon ... 6=Sat

    return horarios.data.some(h => {
        const conv = h.convencion?.toUpperCase().trim() || '';

        let appliesToday = false;
        if (conv === 'L-S') {
            appliesToday = day >= 1 && day <= 6;
        } else if (conv === 'L-V') {
            appliesToday = day >= 1 && day <= 5;
        } else if (conv === 'S' || conv === 'SAB' || conv === 'SABADO' || conv === 'SÁBADO') {
            appliesToday = day === 6;
        } else if (conv === 'D-F' || conv === 'DOM' || conv === 'DOMINGO' || conv.includes('FESTIV')) {
            appliesToday = day === 0;
        } else if (conv === 'D' || conv === 'DOM-FES') {
            appliesToday = day === 0;
        } else {
            appliesToday = true;
        }

        if (!appliesToday) return false;

        const [startH, startM] = h.hora_inicio.replace(/\s*(AM|PM)/i, '').split(':').map(Number);
        const [endH, endM] = h.hora_fin.replace(/\s*(AM|PM)/i, '').split(':').map(Number);
        const startTotal = startH * 60 + (startM || 0);
        const endTotal = endH * 60 + (endM || 0);
        const nowTotal = currentHour * 60 + currentMin;
        return nowTotal >= startTotal && nowTotal <= endTotal;
    });
}

function getScheduleColor(convencion: string): { bg: string; text: string } {
    const conv = convencion?.toUpperCase() || '';
    if (conv.includes('L-S')) return { bg: 'bg-blue-500/10', text: 'text-blue-400' };
    if (conv.includes('D-F') || conv.includes('DOM')) return { bg: 'bg-purple-500/10', text: 'text-purple-400' };
    if (conv.includes('L-V')) return { bg: 'bg-cyan-500/10', text: 'text-cyan-400' };
    return { bg: 'bg-slate-500/10', text: 'text-slate-400' };
}

export default React.memo(function RouteCard({
    route,
    index,
    isFavorite,
    isSelected = false,
    selectionColor,
    onSelect,
    onToggleFavorite,
    onShare,
    onToggleSelect,
}: RouteCardProps) {
    const typeIcon = ROUTE_TYPE_ICONS[route.tipoServicio] || '🚌';
    const active = isActiveNow(route.horarios);

    return (
        <div
            className={`route-card bg-[var(--color-surface)] rounded-2xl p-4 border animate-slide-up cursor-pointer transition-all ${isSelected
                ? 'border-l-4 shadow-lg'
                : 'border-[var(--color-border)]'
                }`}
            style={{
                animationDelay: `${index * 0.06}s`,
                animationFillMode: 'both',
                borderLeftColor: isSelected ? selectionColor : undefined,
            }}
            onClick={() => onSelect(route)}
        >
            {/* Top row: selection + badge + type + service status + actions */}
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    {/* Selection checkbox */}
                    {onToggleSelect && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onToggleSelect(route);
                            }}
                            className={`w-7 h-7 rounded-full flex items-center justify-center transition-all active:scale-90 border-2 ${isSelected
                                ? 'border-transparent text-white'
                                : 'border-gray-300 dark:border-gray-600 hover:border-blue-400'
                                }`}
                            style={{
                                backgroundColor: isSelected ? selectionColor : 'transparent',
                            }}
                            title={isSelected ? 'Quitar de comparación' : 'Agregar a comparación'}
                        >
                            {isSelected && (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                            )}
                        </button>
                    )}

                    {/* Color badge */}
                    <div
                        className="px-3 py-1.5 rounded-xl text-white font-bold text-sm shadow-md"
                        style={{ backgroundColor: route.color || '#6b7280' }}
                    >
                        {route.codigo}
                    </div>
                    {/* Type pill */}
                    <div className="px-2.5 py-1 rounded-lg bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] text-xs font-medium">
                        {typeIcon} {route.tipoServicio || 'N/A'}
                    </div>
                    {/* Active service dot */}
                    {active && (
                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/10">
                            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse-dot" />
                            <span className="text-emerald-400 text-[10px] font-semibold">Activo</span>
                        </div>
                    )}
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-0.5">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onToggleFavorite(route);
                        }}
                        className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all active:scale-90 ${isFavorite
                            ? 'text-amber-400 bg-amber-400/10'
                            : 'text-gray-400 hover:text-amber-400 hover:bg-amber-400/10'
                            }`}
                    >
                        <span className="text-lg">{isFavorite ? '★' : '☆'}</span>
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onShare(route);
                        }}
                        className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 hover:text-blue-400 hover:bg-blue-400/10 transition-all active:scale-90"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Route name */}
            <h3 className="text-[15px] font-semibold text-[var(--color-text)] mb-1 leading-snug">
                {route.nombre}
            </h3>

            {/* Color line accent */}
            <div className="w-12 h-[3px] rounded-full mb-2 opacity-60" style={{ backgroundColor: route.color || '#6b7280' }} />

            {/* Schedule badges — colored by day type */}
            {route.horarios?.data && route.horarios.data.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {route.horarios.data.map((h, i) => {
                        const colors = getScheduleColor(h.convencion);
                        return (
                            <span
                                key={i}
                                className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-semibold ${colors.bg} ${colors.text}`}
                            >
                                {h.convencion}: {h.hora_inicio} - {h.hora_fin}
                            </span>
                        );
                    })}
                </div>
            )}
        </div>
    );
});
