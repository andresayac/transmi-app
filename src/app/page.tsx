'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import AppHeader from '@/components/layout/AppHeader';
import SearchBar from '@/components/search/SearchBar';
import RouteCard from '@/components/search/RouteCard';
import { useRouteSearch } from '@/hooks/useRouteSearch';
import { useFavorites } from '@/hooks/useFavorites';
import { useSelectedRoutes } from '@/hooks/useSelectedRoutes';
import { useSearchHistory } from '@/hooks/useSearchHistory';
import { useToast } from '@/components/ui/Toast';
import { shareRoute } from '@/utils/share';
import { RouteSearchResult } from '@/types/route';
import SaldoCard from '@/components/home/SaldoCard';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

const ROUTE_FILTERS = [
  { key: 'all', label: 'Todos' },
  { key: 'TransMilenio', label: 'TransMilenio' },
  { key: 'TransMiZonal', label: 'Zonal' },
  { key: 'SITP', label: 'SITP' },
];

export default function HomePage() {
  const router = useRouter();
  const { results, loading, error, searchTerm, search, setSearchTerm } = useRouteSearch();
  const { favorites, isFavorite, addFavorite, removeFavorite } = useFavorites();
  const { isSelected, toggleRoute, clearAll, selectedCount, getSelectedArray, getColor } = useSelectedRoutes();
  const { history, addSearch, removeItem, clearHistory } = useSearchHistory();
  const toast = useToast();

  const [activeFilter, setActiveFilter] = useState('all');

  // Filter results by route type
  const filteredResults = useMemo(() => {
    if (activeFilter === 'all') return results;
    return results.filter(r => r.tipoServicio === activeFilter);
  }, [results, activeFilter]);

  // Count per filter
  const filterCounts = useMemo(() => {
    const counts: Record<string, number> = { all: results.length };
    results.forEach(r => {
      counts[r.tipoServicio] = (counts[r.tipoServicio] || 0) + 1;
    });
    return counts;
  }, [results]);

  const handleSearch = (term: string) => {
    search(term);
    addSearch(term);
    setActiveFilter('all');
  };

  const handleSelectRoute = (route: RouteSearchResult) => {
    const params = new URLSearchParams({
      id: route.id,
      nombre: route.nombre,
      codigo: route.codigo,
    });
    router.push(`/mapa?${params.toString()}`);
  };

  const handleToggleFavorite = (route: RouteSearchResult) => {
    if (isFavorite(route.id)) {
      removeFavorite(route.id);
      toast.show(`${route.codigo} eliminada de favoritos`, 'info');
    } else {
      addFavorite(route);
      toast.show(`⭐ ${route.codigo} agregada a favoritos`, 'success');
    }
  };

  const handleShare = async (route: RouteSearchResult) => {
    const result = await shareRoute(route);
    if (result.success) {
      if (result.method === 'clipboard') {
        toast.show('📋 Enlace copiado', 'success');
      }
    }
  };

  const handleToggleSelect = (route: RouteSearchResult) => {
    toggleRoute(route);
    const willBeSelected = !isSelected(route.id);
    if (willBeSelected) {
      toast.show(`✅ ${route.codigo} agregada a comparación`, 'success');
      const newCount = selectedCount + 1;
      if (newCount === 8) {
        setTimeout(() => toast.show('⚠️ Muchas rutas pueden afectar el rendimiento', 'info'), 1500);
      }
    }
  };

  const handleViewMultiRoute = () => {
    const selected = getSelectedArray();
    if (selected.length === 0) return;
    sessionStorage.setItem('multiRoutes', JSON.stringify(selected));
    router.push('/mapa?multi=true');
  };

  const handleViewFavoritesOnMap = () => {
    if (favorites.length === 0) return;
    const mapped = favorites.map((f, i) => ({
      id: f.id,
      codigo: f.codigo,
      nombre: f.nombre,
      tipoServicio: f.tipo || '',
      color: ['#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#84cc16', '#0ea5e9', '#f43f5e', '#6366f1'][i % 12],
      originalColor: f.color || '#6b7280',
    }));
    sessionStorage.setItem('multiRoutes', JSON.stringify(mapped));
    router.push('/mapa?multi=true');
  };

  // Get greeting based on time
  const getTimeGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return '¿A dónde vas hoy?';
    if (hour >= 12 && hour < 18) return '¿A dónde vas?';
    return '¿Viaje nocturno?';
  };

  return (
    <div className="safe-bottom">
      <AppHeader />

      {/* Hero — minimal greeting */}
      <div className="px-5 pt-6 pb-1">
        <h2 className="text-xl font-bold text-foreground">
          {getTimeGreeting()}
        </h2>
      </div>

      <SearchBar
        onSearch={handleSearch}
        loading={loading}
        value={searchTerm}
        onChange={setSearchTerm}
      />

      {/* Search history chips */}
      {!searchTerm && !loading && history.length > 0 && (
        <div className="px-5 pb-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Recientes</span>
            <button
              onClick={() => { clearHistory(); toast.show('Historial limpiado', 'info'); }}
              className="text-[10px] text-destructive/70 font-medium"
            >
              Limpiar
            </button>
          </div>
          <div className="flex gap-1.5 overflow-x-auto scrollbar-hidden">
            {history.map((term) => (
              <Button
                key={term}
                variant="secondary"
                size="sm"
                className="rounded-lg text-[11px] gap-1.5 h-7"
                onClick={() => { setSearchTerm(term); handleSearch(term); }}
              >
                <svg className="w-3 h-3 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {term}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Route type filters */}
      {!loading && results.length > 0 && (
        <div className="px-5 pb-3 flex gap-1.5 overflow-x-auto scrollbar-hidden">
          {ROUTE_FILTERS.map((f) => {
            const count = filterCounts[f.key] || 0;
            if (f.key !== 'all' && count === 0) return null;
            const isActive = activeFilter === f.key;
            return (
              <Button
                key={f.key}
                variant={isActive ? 'default' : 'secondary'}
                size="sm"
                className="rounded-lg text-[11px] h-7 gap-1"
                onClick={() => setActiveFilter(f.key)}
              >
                {f.label}
                <span className={isActive ? 'text-primary-foreground/60' : 'text-muted-foreground'}>
                  {count}
                </span>
              </Button>
            );
          })}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="px-5 pb-4">
          <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-3 text-center">
            <p className="text-destructive text-xs font-medium">{error}</p>
          </div>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="px-5 space-y-2.5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-card rounded-xl p-3.5 border border-border">
              <div className="flex items-center gap-3 mb-2">
                <Skeleton className="w-14 h-7 rounded-lg" />
                <Skeleton className="w-20 h-5 rounded-md" />
              </div>
              <Skeleton className="w-2/3 h-3.5 mb-1.5" />
              <Skeleton className="w-1/3 h-3" />
            </div>
          ))}
        </div>
      )}

      {/* Results */}
      {!loading && filteredResults.length > 0 && (
        <div className="px-5 pb-4">
          <p className="text-[10px] text-muted-foreground font-medium mb-2.5 uppercase tracking-wider">
            {filteredResults.length} ruta{filteredResults.length !== 1 ? 's' : ''}{activeFilter !== 'all' ? ` · ${activeFilter}` : ''}
            {selectedCount > 0 && (
              <span className="text-primary ml-1 normal-case">
                · {selectedCount} seleccionada{selectedCount !== 1 ? 's' : ''}
              </span>
            )}
          </p>
          <div className="space-y-2.5">
            {filteredResults.map((route, index) => (
              <RouteCard
                key={route.id}
                route={route}
                index={index}
                isFavorite={isFavorite(route.id)}
                isSelected={isSelected(route.id)}
                selectionColor={getColor(route.id)}
                onSelect={handleSelectRoute}
                onToggleFavorite={handleToggleFavorite}
                onShare={handleShare}
                onToggleSelect={handleToggleSelect}
              />
            ))}
          </div>
        </div>
      )}

      {/* No results for active filter */}
      {!loading && results.length > 0 && filteredResults.length === 0 && (
        <div className="px-5 py-8 text-center">
          <p className="text-muted-foreground text-sm">
            No hay rutas <strong>{activeFilter}</strong>
          </p>
          <Button variant="link" size="sm" onClick={() => setActiveFilter('all')} className="mt-1 text-primary">
            Ver todas
          </Button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && results.length === 0 && searchTerm && (
        <div className="px-5 py-14 text-center">
          <div className="w-14 h-14 mx-auto mb-3 rounded-xl bg-secondary flex items-center justify-center">
            <svg className="w-7 h-7 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          </div>
          <p className="text-foreground font-semibold text-sm mb-0.5">Sin resultados</p>
          <p className="text-muted-foreground text-xs">Intenta con otro término</p>
        </div>
      )}

      {/* Initial state — no search */}
      {!loading && !searchTerm && (
        <div className="px-5 pt-3">
          <SaldoCard />

          {/* Favorites */}
          {favorites.length > 0 && (
            <div className="mt-5">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Favoritos</h3>
                {favorites.length >= 2 && (
                  <button onClick={handleViewFavoritesOnMap} className="text-[10px] text-primary font-semibold">
                    Ver en mapa →
                  </button>
                )}
              </div>
              <div className="flex gap-2 overflow-x-auto scrollbar-hidden">
                {favorites.map((fav) => (
                  <button
                    key={fav.id}
                    onClick={() => {
                      const params = new URLSearchParams({ id: fav.id, nombre: fav.nombre, codigo: fav.codigo });
                      router.push(`/mapa?${params.toString()}`);
                    }}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-card border border-border whitespace-nowrap active:scale-95 transition-all"
                  >
                    <span
                      className="px-1.5 py-0.5 rounded-md text-white text-[10px] font-bold"
                      style={{ backgroundColor: fav.color || '#6b7280' }}
                    >
                      {fav.codigo}
                    </span>
                    <span className="text-foreground text-[11px] font-medium max-w-[80px] truncate">
                      {fav.nombre}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Explore CTA */}
          <button
            onClick={() => router.push('/explorar')}
            className="w-full flex items-center gap-3 mt-5 p-3.5 rounded-xl bg-card border border-border hover:border-primary/30 transition-all active:scale-[0.98] text-left"
          >
            <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7l6-3 5.447 2.724A1 1 0 0121 7.618v10.764a1 1 0 01-1.447.894L15 17l-6 3z" />
              </svg>
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-foreground">Explorar el sistema</h4>
              <p className="text-[11px] text-muted-foreground">Troncales, zonas y paradas</p>
            </div>
            <svg className="w-4 h-4 text-muted-foreground flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* Popular searches */}
          {history.length === 0 && (
            <div className="mt-5">
              <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-2 block">Populares</span>
              <div className="flex gap-1.5 flex-wrap">
                {['E44', 'B12', 'Portal Norte', 'Suba', 'Calle 80'].map((chip) => (
                  <Button
                    key={chip}
                    variant="secondary"
                    size="sm"
                    className="rounded-lg text-[11px] h-7"
                    onClick={() => { setSearchTerm(chip); handleSearch(chip); }}
                  >
                    {chip}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* FAB — multi-route selection */}
      {selectedCount > 0 && (
        <div
          className="fixed left-1/2 -translate-x-1/2 z-50 animate-slide-up"
          style={{ bottom: 'calc(var(--bottom-nav-height) + 12px)' }}
        >
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary shadow-xl shadow-primary/25">
            <div className="flex -space-x-1 mr-1">
              {getSelectedArray().slice(0, 4).map((r) => (
                <div
                  key={r.id}
                  className="w-4 h-4 rounded-full border-2 border-white"
                  style={{ backgroundColor: r.color }}
                />
              ))}
              {selectedCount > 4 && (
                <div className="w-4 h-4 rounded-full bg-white/30 border-2 border-white flex items-center justify-center text-[8px] font-bold text-white">
                  +{selectedCount - 4}
                </div>
              )}
            </div>
            <span className="text-primary-foreground text-xs font-semibold whitespace-nowrap">
              {selectedCount} ruta{selectedCount !== 1 ? 's' : ''}
            </span>
            <Button
              variant="secondary"
              size="sm"
              className="rounded-lg text-xs font-bold h-7"
              onClick={handleViewMultiRoute}
            >
              Ver en mapa
            </Button>
            <button
              onClick={() => { clearAll(); toast.show('Selección limpiada', 'info'); }}
              className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-white text-xs active:scale-90 transition-all"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}