import { RouteSearchResult } from '@/types/route';
import { BusLocation } from '@/types/bus';
import { Troncal, Estacion, ZonaOperacional, Parada, BusETA } from '@/types/explorar';
import { RouteCatalogEntry, RouteCatalog, CatalogProgress } from '@/types/catalog';
import { StationMapEntry, StationCache } from '@/types/station';
import { CACHE_TTL, BUS_CACHE_TTL } from '@/utils/constants';

interface CacheEntry<T> {
    data: T;
    timestamp: number;
}

const LONG_CACHE_TTL = 60 * 60 * 1000; // 1 hour

class TransMilenioService {
    private cache = new Map<string, CacheEntry<unknown>>();

    private isCacheValid(key: string, ttl: number = CACHE_TTL): boolean {
        const cached = this.cache.get(key);
        if (!cached) return false;
        return (Date.now() - cached.timestamp) < ttl;
    }

    private getCache<T>(key: string): T | null {
        const cached = this.cache.get(key);
        return cached ? (cached.data as T) : null;
    }

    private setCache<T>(key: string, data: T): void {
        this.cache.set(key, { data, timestamp: Date.now() });
    }

    // ─── Existing ────────────────────────────────────────────

    async searchRoutes(search: string, tipoRuta: string = 'TIPORUTA'): Promise<RouteSearchResult[]> {
        const cacheKey = `search_${search}_${tipoRuta}`;

        if (this.isCacheValid(cacheKey)) {
            return this.getCache<RouteSearchResult[]>(cacheKey) || [];
        }

        const url = `/api/routes/search?search=${encodeURIComponent(search)}&tipoRuta=${encodeURIComponent(tipoRuta)}`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        const routes: RouteSearchResult[] = Array.isArray(data.lista_rutas) ? data.lista_rutas : [];
        this.setCache(cacheKey, routes);
        return routes;
    }

    async getRouteInfo(idRuta: string, nombre: string, codigo: string) {
        const cacheKey = `route_${idRuta}_${codigo}`;

        if (this.isCacheValid(cacheKey)) {
            return this.getCache(cacheKey);
        }

        const url = `/api/routes/info?idRuta=${encodeURIComponent(idRuta)}&nombre=${encodeURIComponent(nombre)}&codigo=${encodeURIComponent(codigo)}`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        this.setCache(cacheKey, data);
        return data;
    }

    async getBusesLocation(rutaCodigo: string, nombre: string): Promise<BusLocation[]> {
        const cacheKey = `buses_${rutaCodigo}_${nombre}`;

        if (this.isCacheValid(cacheKey, BUS_CACHE_TTL)) {
            return this.getCache<BusLocation[]>(cacheKey) || [];
        }

        const url = `/api/buses?ruta=${encodeURIComponent(rutaCodigo)}&nombre=${encodeURIComponent(nombre)}`;
        const response = await fetch(url, { method: 'POST' });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        const buses: BusLocation[] = data || [];
        this.setCache(cacheKey, buses);
        return buses;
    }

    // ─── Troncales ───────────────────────────────────────────

    async getTroncales(): Promise<Troncal[]> {
        const cacheKey = 'troncales';

        if (this.isCacheValid(cacheKey, LONG_CACHE_TTL)) {
            return this.getCache<Troncal[]>(cacheKey) || [];
        }

        const response = await fetch('/api/troncales');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const data = await response.json();
        const troncales: Troncal[] = data.lista_troncales || [];
        this.setCache(cacheKey, troncales);
        return troncales;
    }

    async getEstacionesByTroncal(troncalId: string): Promise<Estacion[]> {
        const cacheKey = `estaciones_${troncalId}`;

        if (this.isCacheValid(cacheKey, LONG_CACHE_TTL)) {
            return this.getCache<Estacion[]>(cacheKey) || [];
        }

        const response = await fetch(`/api/troncales/${encodeURIComponent(troncalId)}/estaciones`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const data = await response.json();
        const estaciones: Estacion[] = data.lista_estaciones || [];
        this.setCache(cacheKey, estaciones);
        return estaciones;
    }

    async getRutasByEstacion(estacionId: string): Promise<RouteSearchResult[]> {
        const cacheKey = `rutas_estacion_${estacionId}`;

        if (this.isCacheValid(cacheKey)) {
            return this.getCache<RouteSearchResult[]>(cacheKey) || [];
        }

        const response = await fetch(`/api/estaciones/${encodeURIComponent(estacionId)}/rutas`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const data = await response.json();
        const rutas: RouteSearchResult[] = data.lista_rutas || [];
        this.setCache(cacheKey, rutas);
        return rutas;
    }

    // ─── Zonas ───────────────────────────────────────────────

    async getZonas(): Promise<ZonaOperacional[]> {
        const cacheKey = 'zonas';

        if (this.isCacheValid(cacheKey, LONG_CACHE_TTL)) {
            return this.getCache<ZonaOperacional[]>(cacheKey) || [];
        }

        const response = await fetch('/api/zonas');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const data = await response.json();
        const zonas: ZonaOperacional[] = data.lista_zonas || [];
        this.setCache(cacheKey, zonas);
        return zonas;
    }

    async getRutasByZona(zonaId: string): Promise<RouteSearchResult[]> {
        const cacheKey = `rutas_zona_${zonaId}`;

        if (this.isCacheValid(cacheKey)) {
            return this.getCache<RouteSearchResult[]>(cacheKey) || [];
        }

        const response = await fetch(`/api/zonas/${encodeURIComponent(zonaId)}/rutas`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const data = await response.json();
        const rutas: RouteSearchResult[] = data.lista_rutas || [];
        this.setCache(cacheKey, rutas);
        return rutas;
    }

    // ─── Paradas ─────────────────────────────────────────────

    async searchParadas(search: string): Promise<Parada[]> {
        const cacheKey = `paradas_${search}`;

        if (this.isCacheValid(cacheKey)) {
            return this.getCache<Parada[]>(cacheKey) || [];
        }

        const response = await fetch(`/api/paradas?search=${encodeURIComponent(search)}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const data = await response.json();
        const paradas: Parada[] = data.listParadas || [];
        this.setCache(cacheKey, paradas);
        return paradas;
    }

    // ─── ETA ─────────────────────────────────────────────────

    async getServicios(estacion: string, ruta: string, idRuta: string, nombre: string): Promise<BusETA[]> {
        const cacheKey = `eta_${estacion}_${ruta}`;

        if (this.isCacheValid(cacheKey, 20000)) { // 20 sec cache
            return this.getCache<BusETA[]>(cacheKey) || [];
        }

        const response = await fetch('/api/servicios', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ estacion, ruta, idRuta, Nombre: nombre, Distancia: '100' }),
        });

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const data = await response.json();
        const servicios: BusETA[] = Array.isArray(data) ? data : [];
        this.setCache(cacheKey, servicios);
        return servicios;
    }

    // ─── Saldo ───────────────────────────────────────────────

    async consultarSaldo(numeroTarjeta: string) {
        const response = await fetch('/api/saldo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ numero_tarjeta: numeroTarjeta }),
        });

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return response.json();
    }

    // ─── Route Catalog (bulk load) ────────────────────────

    private static CATALOG_KEY = 'tm_route_catalog';
    private static CATALOG_TTL = 24 * 60 * 60 * 1000; // 24 hours

    /** Return cached catalog from localStorage if still valid */
    getRouteCatalog(): RouteCatalog | null {
        if (typeof window === 'undefined') return null;
        try {
            const raw = localStorage.getItem(TransMilenioService.CATALOG_KEY);
            if (!raw) return null;
            const catalog: RouteCatalog = JSON.parse(raw);
            if (Date.now() - catalog.timestamp < TransMilenioService.CATALOG_TTL) {
                return catalog;
            }
            localStorage.removeItem(TransMilenioService.CATALOG_KEY);
        } catch { /* corrupted */ }
        return null;
    }

    /** Save catalog to localStorage */
    private saveRouteCatalog(catalog: RouteCatalog): void {
        if (typeof window === 'undefined') return;
        try {
            localStorage.setItem(TransMilenioService.CATALOG_KEY, JSON.stringify(catalog));
        } catch { /* quota exceeded – silently fail */ }
    }

    /** Clear persisted catalog */
    clearRouteCatalog(): void {
        if (typeof window === 'undefined') return;
        localStorage.removeItem(TransMilenioService.CATALOG_KEY);
    }

    /** Run async tasks with max concurrency */
    private async runWithConcurrency<T>(tasks: (() => Promise<T>)[], maxConcurrency: number): Promise<T[]> {
        const results: T[] = [];
        let idx = 0;

        const runNext = async (): Promise<void> => {
            while (idx < tasks.length) {
                const currentIdx = idx++;
                results[currentIdx] = await tasks[currentIdx]();
            }
        };

        const workers = Array.from({ length: Math.min(maxConcurrency, tasks.length) }, () => runNext());
        await Promise.all(workers);
        return results;
    }

    /**
     * Load ALL routes from ALL troncales, deduplicate, and cache.
     * Reports progress via callback.
     */
    async getAllRouteCatalog(
        onProgress?: (progress: CatalogProgress) => void,
        forceRefresh = false,
    ): Promise<RouteCatalog> {
        // Check cache first
        if (!forceRefresh) {
            const cached = this.getRouteCatalog();
            if (cached) return cached;
        }

        // Phase 1: Troncales
        onProgress?.({ phase: 'troncales', loaded: 0, total: 1, label: 'Cargando troncales...' });
        const troncales = await this.getTroncales();
        onProgress?.({ phase: 'troncales', loaded: 1, total: 1, label: `${troncales.length} troncales` });

        // Phase 2: Estaciones (max 3 concurrent)
        const allEstaciones: { troncal: Troncal; estaciones: Estacion[] }[] = [];
        let estLoaded = 0;

        const estTasks = troncales.map((troncal) => async () => {
            const estaciones = await this.getEstacionesByTroncal(troncal.id);
            estLoaded++;
            onProgress?.({
                phase: 'estaciones',
                loaded: estLoaded,
                total: troncales.length,
                label: `Estaciones: ${troncal.nombre}`,
            });
            return { troncal, estaciones };
        });

        const estResults = await this.runWithConcurrency(estTasks, 3);
        allEstaciones.push(...estResults);

        // Phase 3: Rutas por estación (max 5 concurrent)
        const totalEstaciones = allEstaciones.reduce((sum, e) => sum + e.estaciones.length, 0);
        let rutLoaded = 0;
        const routeMap = new Map<string, RouteCatalogEntry>();

        const rutTasks: (() => Promise<void>)[] = [];

        for (const { troncal, estaciones } of allEstaciones) {
            for (const estacion of estaciones) {
                rutTasks.push(async () => {
                    try {
                        const rutas = await this.getRutasByEstacion(estacion.id);
                        for (const ruta of rutas) {
                            if (!routeMap.has(ruta.id)) {
                                routeMap.set(ruta.id, {
                                    id: ruta.id,
                                    codigo: ruta.codigo,
                                    nombre: ruta.nombre,
                                    tipoServicio: ruta.tipoServicio,
                                    color: ruta.color,
                                    troncalId: troncal.id,
                                    troncalNombre: troncal.nombre,
                                    troncalColor: troncal.color,
                                    troncalLetra: troncal.letra,
                                    estacionId: estacion.id,
                                    estacionNombre: estacion.nombre,
                                });
                            }
                        }
                    } catch { /* skip failed station */ }
                    rutLoaded++;
                    onProgress?.({
                        phase: 'rutas',
                        loaded: rutLoaded,
                        total: totalEstaciones,
                        label: `Rutas: ${estacion.nombre}`,
                    });
                });
            }
        }

        await this.runWithConcurrency(rutTasks, 5);

        const catalog: RouteCatalog = {
            entries: Array.from(routeMap.values()),
            timestamp: Date.now(),
            troncalCount: troncales.length,
            estacionCount: totalEstaciones,
        };

        this.saveRouteCatalog(catalog);
        return catalog;
    }

    // ─── Station Explorer ─────────────────────────────────

    private static STATIONS_KEY = 'tm_stations_cache';
    private static STATIONS_TTL = 2 * 60 * 60 * 1000; // 2 hours (matches server)

    getStationCache(): StationCache | null {
        if (typeof window === 'undefined') return null;
        try {
            const raw = localStorage.getItem(TransMilenioService.STATIONS_KEY);
            if (!raw) return null;
            const cache: StationCache = JSON.parse(raw);
            // Reject empty or expired caches
            if (!cache.stations?.length || Date.now() - cache.timestamp >= TransMilenioService.STATIONS_TTL) {
                localStorage.removeItem(TransMilenioService.STATIONS_KEY);
                return null;
            }
            return cache;
        } catch { /* corrupted */ }
        return null;
    }

    private saveStationCache(cache: StationCache): void {
        if (typeof window === 'undefined') return;
        try {
            localStorage.setItem(TransMilenioService.STATIONS_KEY, JSON.stringify(cache));
        } catch { /* quota */ }
    }

    /**
     * Fetch all stations from server-side cache.
     * Server does the heavy lifting (bulk fetch + 2h cache).
     * Client also caches in localStorage for instant loads.
     */
    async getAllEstaciones(forceRefresh = false): Promise<StationMapEntry[]> {
        if (!forceRefresh) {
            const cached = this.getStationCache();
            if (cached) return cached.stations;
        }

        const response = await fetch('/api/stations');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const data = await response.json();
        const stations: StationMapEntry[] = data.stations || [];

        this.saveStationCache({ stations, timestamp: Date.now() });
        return stations;
    }

    clearCache(): void {
        this.cache.clear();
    }
}

// Singleton
export const transmilenioApi = new TransMilenioService();
