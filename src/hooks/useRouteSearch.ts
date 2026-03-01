'use client';

import { useState, useCallback } from 'react';
import { transmilenioApi } from '@/services/transmilenio';
import { RouteSearchResult } from '@/types/route';

export function useRouteSearch() {
    const [results, setResults] = useState<RouteSearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    const search = useCallback(async (term: string) => {
        if (!term.trim()) return;

        setSearchTerm(term);
        setLoading(true);
        setError(null);

        try {
            const routes = await transmilenioApi.searchRoutes(term);
            setResults(routes);
        } catch (err) {
            console.error('Search error:', err);
            setError('Error al buscar rutas. Verifica tu conexión.');
            setResults([]);
        } finally {
            setLoading(false);
        }
    }, []);

    const clearSearch = useCallback(() => {
        setResults([]);
        setSearchTerm('');
        setError(null);
    }, []);

    return { results, loading, error, searchTerm, search, clearSearch, setSearchTerm };
}
