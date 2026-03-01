'use client';

import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'transmi_search_history';
const MAX_HISTORY = 10;

export function useSearchHistory() {
    const [history, setHistory] = useState<string[]>([]);

    // Load from localStorage on mount
    useEffect(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                setHistory(JSON.parse(stored));
            }
        } catch {
            // ignore
        }
    }, []);

    const addSearch = useCallback((term: string) => {
        const trimmed = term.trim();
        if (!trimmed) return;

        setHistory(prev => {
            // Remove duplicates, add to front, cap at MAX_HISTORY
            const filtered = prev.filter(t => t.toLowerCase() !== trimmed.toLowerCase());
            const next = [trimmed, ...filtered].slice(0, MAX_HISTORY);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
            return next;
        });
    }, []);

    const removeItem = useCallback((term: string) => {
        setHistory(prev => {
            const next = prev.filter(t => t !== term);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
            return next;
        });
    }, []);

    const clearHistory = useCallback(() => {
        setHistory([]);
        localStorage.removeItem(STORAGE_KEY);
    }, []);

    return { history, addSearch, removeItem, clearHistory };
}
