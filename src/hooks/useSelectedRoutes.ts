'use client';

import { useState, useCallback } from 'react';
import { RouteSearchResult } from '@/types/route';
import { ROUTE_COLORS } from '@/utils/constants';

export interface SelectedRouteEntry {
    id: string;
    codigo: string;
    nombre: string;
    tipoServicio: string;
    color: string; // assigned comparison color
    originalColor: string; // original route color
}

export function useSelectedRoutes() {
    const [selectedRoutes, setSelectedRoutes] = useState<Map<string, SelectedRouteEntry>>(new Map());
    const [colorIndex, setColorIndex] = useState(0);

    const isSelected = useCallback((id: string) => selectedRoutes.has(id), [selectedRoutes]);

    const toggleRoute = useCallback((route: RouteSearchResult) => {
        setSelectedRoutes(prev => {
            const next = new Map(prev);
            if (next.has(route.id)) {
                next.delete(route.id);
            } else {
                const assignedColor = ROUTE_COLORS[colorIndex % ROUTE_COLORS.length];
                next.set(route.id, {
                    id: route.id,
                    codigo: route.codigo,
                    nombre: route.nombre,
                    tipoServicio: route.tipoServicio,
                    color: assignedColor,
                    originalColor: route.color,
                });
                setColorIndex(ci => ci + 1);
            }
            return next;
        });
    }, [colorIndex]);

    const removeRoute = useCallback((id: string) => {
        setSelectedRoutes(prev => {
            const next = new Map(prev);
            next.delete(id);
            return next;
        });
    }, []);

    const clearAll = useCallback(() => {
        setSelectedRoutes(new Map());
        setColorIndex(0);
    }, []);

    const getSelectedArray = useCallback(() => {
        return Array.from(selectedRoutes.values());
    }, [selectedRoutes]);

    return {
        selectedRoutes,
        selectedCount: selectedRoutes.size,
        isSelected,
        toggleRoute,
        removeRoute,
        clearAll,
        getSelectedArray,
        getColor: (id: string) => selectedRoutes.get(id)?.color,
    };
}
