'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { useEffect, useSyncExternalStore } from 'react';
import type { Itinerary, PlanPlace } from '@/types/transit';
import { DEFAULT_TTS_VOICE } from '@/lib/voices';

export interface FavoriteRoute {
    id: string;
    codigo: string;
    nombre: string;
    tipo: string;
    color: string;
    addedAt: string;
}

export interface SavedPlace extends PlanPlace {
    id: string;
    label: string;
}

export interface TripLog {
    id: string;
    from: string;
    to: string;
    startedAt: string;
    endedAt: string;
    durationMin: number;
    distanceM: number;
    lines: string[];
}

export interface ActiveTrip {
    itinerary: Itinerary;
    from: PlanPlace;
    to: PlanPlace;
    startedAt: string;
}

export type ThemePref = 'system' | 'light' | 'dark';

export interface Settings {
    theme: ThemePref;
    /** Spoken announcements during a trip */
    voice: boolean;
    /** Stops before the destination at which the wake-up alarm fires */
    alarmStops: number;
    mapLight: 'auto' | 'day' | 'night';
    /** Edge neural voice for announcements and read-aloud (see lib/voices.ts) */
    ttsVoice: string;
}

interface AppState {
    favorites: FavoriteRoute[];
    searchHistory: string[];
    home: SavedPlace | null;
    work: SavedPlace | null;
    savedPlaces: SavedPlace[];
    recentPlaces: PlanPlace[];
    trips: TripLog[];
    activeTrip: ActiveTrip | null;
    cardNumber: string;
    lastBalance: { value: number; at: string } | null;
    settings: Settings;

    addFavorite: (route: { id: string; codigo: string; nombre: string; tipo?: string; tipoServicio?: string; color?: string }) => void;
    removeFavorite: (id: string) => void;
    clearFavorites: () => void;
    addSearch: (term: string) => void;
    removeSearch: (term: string) => void;
    clearSearches: () => void;
    setHome: (place: PlanPlace | null) => void;
    setWork: (place: PlanPlace | null) => void;
    savePlace: (place: PlanPlace, label: string) => void;
    removePlace: (id: string) => void;
    pushRecentPlace: (place: PlanPlace) => void;
    startTrip: (trip: Omit<ActiveTrip, 'startedAt'>) => void;
    endTrip: (completed: boolean) => void;
    setCard: (number: string, balance?: number) => void;
    updateSettings: (patch: Partial<Settings>) => void;
}

const STORAGE_KEY = 'transmi-store';

function readLegacy<T>(key: string, fallback: T): T {
    try {
        const raw = localStorage.getItem(key);
        return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
        return fallback;
    }
}

const uid = () => Math.random().toString(36).slice(2, 10);

const samePlace = (a: PlanPlace, b: PlanPlace) => Math.abs(a.lat - b.lat) < 0.0003 && Math.abs(a.lng - b.lng) < 0.0003;

export const useAppStore = create<AppState>()(
    persist(
        (set, get) => ({
            favorites: [],
            searchHistory: [],
            home: null,
            work: null,
            savedPlaces: [],
            recentPlaces: [],
            trips: [],
            activeTrip: null,
            cardNumber: '',
            lastBalance: null,
            settings: { theme: 'system', voice: true, alarmStops: 2, mapLight: 'auto', ttsVoice: DEFAULT_TTS_VOICE },

            addFavorite: (route) => {
                if (get().favorites.some((f) => f.id === route.id)) return;
                set((s) => ({
                    favorites: [
                        {
                            id: route.id,
                            codigo: route.codigo,
                            nombre: route.nombre,
                            tipo: route.tipo || route.tipoServicio || '',
                            color: route.color || '#6b7280',
                            addedAt: new Date().toISOString(),
                        },
                        ...s.favorites,
                    ],
                }));
            },
            removeFavorite: (id) => set((s) => ({ favorites: s.favorites.filter((f) => f.id !== id) })),
            clearFavorites: () => set({ favorites: [] }),

            addSearch: (term) => {
                const t = term.trim();
                if (!t) return;
                set((s) => ({ searchHistory: [t, ...s.searchHistory.filter((x) => x.toLowerCase() !== t.toLowerCase())].slice(0, 10) }));
            },
            removeSearch: (term) => set((s) => ({ searchHistory: s.searchHistory.filter((x) => x !== term) })),
            clearSearches: () => set({ searchHistory: [] }),

            setHome: (place) => set({ home: place ? { ...place, id: 'home', label: 'Casa', kind: 'home' } : null }),
            setWork: (place) => set({ work: place ? { ...place, id: 'work', label: 'Trabajo', kind: 'work' } : null }),
            savePlace: (place, label) => set((s) => ({ savedPlaces: [{ ...place, id: uid(), label, kind: 'saved' as const }, ...s.savedPlaces].slice(0, 20) })),
            removePlace: (id) => set((s) => ({ savedPlaces: s.savedPlaces.filter((p) => p.id !== id) })),
            pushRecentPlace: (place) => {
                if (place.kind === 'gps') return;
                set((s) => ({ recentPlaces: [place, ...s.recentPlaces.filter((p) => !samePlace(p, place))].slice(0, 8) }));
            },

            startTrip: (trip) => set({ activeTrip: { ...trip, startedAt: new Date().toISOString() } }),
            endTrip: (completed) => {
                const trip = get().activeTrip;
                if (trip && completed) {
                    const started = new Date(trip.startedAt);
                    const log: TripLog = {
                        id: uid(),
                        from: trip.from.name,
                        to: trip.to.name,
                        startedAt: trip.startedAt,
                        endedAt: new Date().toISOString(),
                        durationMin: Math.max(1, Math.round((Date.now() - started.getTime()) / 60000)),
                        distanceM: trip.itinerary.legs.reduce((s, l) => s + l.distanceM, 0),
                        lines: trip.itinerary.legs.filter((l) => l.line).map((l) => l.line!.code),
                    };
                    set((s) => ({ trips: [log, ...s.trips].slice(0, 500) }));
                }
                set({ activeTrip: null });
            },

            setCard: (number, balance) =>
                set({ cardNumber: number, ...(balance !== undefined ? { lastBalance: { value: balance, at: new Date().toISOString() } } : {}) }),

            updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
        }),
        {
            name: STORAGE_KEY,
            version: 1,
            storage: createJSONStorage(() => localStorage),
            skipHydration: true,
            merge: (persisted, current) => {
                if (persisted) return { ...current, ...(persisted as Partial<AppState>), settings: { ...current.settings, ...((persisted as Partial<AppState>).settings || {}) } };
                // First run on v3: bring over data saved by the previous version
                const legacyDark = typeof window !== 'undefined' ? localStorage.getItem('darkMode') : null;
                return {
                    ...current,
                    favorites: readLegacy<FavoriteRoute[]>('transmilenio_favorites', []),
                    searchHistory: readLegacy<string[]>('transmi_search_history', []),
                    cardNumber: typeof window !== 'undefined' ? localStorage.getItem('tm_last_card') || '' : '',
                    settings: { ...current.settings, theme: legacyDark === 'true' ? 'dark' : legacyDark === 'false' ? 'light' : 'system' },
                };
            },
        },
    ),
);

// Keep open tabs in sync: when another tab saves, reload that data here, so this
// tab's older in-memory state can't overwrite it on its next save.
if (typeof window !== 'undefined') {
    window.addEventListener('storage', (event) => {
        if (event.key === STORAGE_KEY && event.newValue && useAppStore.persist.hasHydrated()) void useAppStore.persist.rehydrate();
    });
}

/** True once persisted state has been loaded (avoids SSR/client mismatches). */
export function useHydrated(): boolean {
    const hydrated = useSyncExternalStore(
        (onChange) => useAppStore.persist.onFinishHydration(onChange),
        () => useAppStore.persist.hasHydrated(),
        () => false,
    );
    useEffect(() => {
        if (!useAppStore.persist.hasHydrated()) useAppStore.persist.rehydrate();
    }, []);
    return hydrated;
}

export const THEME_STORAGE_KEY = STORAGE_KEY;
