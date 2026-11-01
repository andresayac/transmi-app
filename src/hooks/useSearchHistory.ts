'use client';

import { useAppStore, useHydrated } from '@/stores/app';

export function useSearchHistory() {
    const hydrated = useHydrated();
    const history = useAppStore((s) => s.searchHistory);
    const addSearch = useAppStore((s) => s.addSearch);
    const removeItem = useAppStore((s) => s.removeSearch);
    const clearHistory = useAppStore((s) => s.clearSearches);
    return { history: hydrated ? history : [], addSearch, removeItem, clearHistory };
}
