'use client';

import { useState, useCallback, useEffect } from 'react';

interface FavoriteRoute {
    id: string;
    codigo: string;
    nombre: string;
    tipo: string;
    color: string;
    addedAt: string;
}

const STORAGE_KEY = 'transmilenio_favorites';

export function useFavorites() {
    const [favorites, setFavorites] = useState<FavoriteRoute[]>([]);

    useEffect(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) setFavorites(JSON.parse(stored));
        } catch {
            console.error('Error loading favorites');
        }
    }, []);

    const save = useCallback((favs: FavoriteRoute[]) => {
        setFavorites(favs);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(favs));
    }, []);

    const addFavorite = useCallback((route: { id: string; codigo: string; nombre: string; tipo?: string; tipoServicio?: string; color?: string }) => {
        setFavorites((prev) => {
            if (prev.some((f) => f.id === route.id)) return prev;
            const newFav: FavoriteRoute = {
                id: route.id,
                codigo: route.codigo,
                nombre: route.nombre,
                tipo: route.tipo || route.tipoServicio || '',
                color: route.color || '#6b7280',
                addedAt: new Date().toISOString(),
            };
            const updated = [newFav, ...prev];
            localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
            window.dispatchEvent(new Event('favoritesChanged'));
            return updated;
        });
    }, []);

    const removeFavorite = useCallback((id: string) => {
        setFavorites((prev) => {
            const updated = prev.filter((f) => f.id !== id);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
            window.dispatchEvent(new Event('favoritesChanged'));
            return updated;
        });
    }, []);

    const isFavorite = useCallback((id: string): boolean => {
        return favorites.some((f) => f.id === id);
    }, [favorites]);

    const clearAll = useCallback(() => {
        save([]);
    }, [save]);

    return { favorites, addFavorite, removeFavorite, isFavorite, clearAll };
}
