'use client';

import { useCallback } from 'react';
import { useAppStore, useHydrated } from '@/stores/app';

export type { FavoriteRoute } from '@/stores/app';

export function useFavorites() {
    const hydrated = useHydrated();
    const favorites = useAppStore((s) => s.favorites);
    const addFavorite = useAppStore((s) => s.addFavorite);
    const removeFavorite = useAppStore((s) => s.removeFavorite);
    const clearAll = useAppStore((s) => s.clearFavorites);

    const isFavorite = useCallback((id: string) => favorites.some((f) => f.id === id), [favorites]);

    return { favorites: hydrated ? favorites : [], addFavorite, removeFavorite, isFavorite, clearAll };
}
