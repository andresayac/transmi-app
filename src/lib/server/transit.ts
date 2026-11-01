import 'server-only';

import { bodega, cached, loader, planner } from './upstream';
import { BOGOTA_BBOX, LngLat, boundsOf, haversine, parseCoord, simplify } from '@/lib/geo';
import { colorForRouteCode, readableOn, TRONCAL_COLORS, ZONAL_BLUE } from '@/lib/color';
import type {
    Arrival,
    Itinerary,
    ItineraryTag,
    LiveBus,
    Occupancy,
    PlanLeg,
    PlanLine,
    PlanPlace,
    PlanStop,
    RouteDetailNormalized,
    ServicePoint,
    StopEta,
    WeatherNow,
} from '@/types/transit';
import type { StationMapEntry } from '@/types/station';
import type { RouteSearchResult } from '@/types/route';

// ─── Stations (all stops, cached 2h) ─────────────────────

interface RawParada {
    id: string;
    codigo: string;
    nombre: string;
    nombreSinTilde: string;
    direccion: string;
    coordenada: string;
    sistema: string;
}

async function fetchParadas(search: string): Promise<RawParada[]> {
    try {
        const data = await loader<{ listParadas?: RawParada[] }>('getParaderosList', { search }, 7200);
        return data.listParadas || [];
    } catch {
        return [];
    }
}

export function getStations(): Promise<StationMapEntry[]> {
    return cached('stations', 2 * 60 * 60 * 1000, async () => {
        // "a" alone returns ~6700 stops, but a few names don't contain it
        const terms = ['a', 'e', 'o', 'portal', 'calle', 'carrera', 'estacion'];
        const batches = await Promise.all(terms.map(fetchParadas));
        const byId = new Map<string, RawParada>();
        for (const batch of batches) for (const p of batch) if (!byId.has(p.id)) byId.set(p.id, p);

        const stations: StationMapEntry[] = [];
        for (const p of byId.values()) {
            const c = parseCoord(p.coordenada);
            if (!c) continue;
            stations.push({ id: p.id, codigo: p.codigo, nombre: p.nombre, direccion: p.direccion, lat: c.lat, lng: c.lng, sistema: p.sistema });
        }
        if (!stations.length) throw new Error('No stations returned');
        return stations;
    });
}

const normalizeText = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export async function findStations(query: string, limit = 6, onlyTroncal = false): Promise<StationMapEntry[]> {
    const q = normalizeText(query.replace(/^estaci[oó]n\s+/i, ''));
    if (q.length < 2) return [];
    const stations = await getStations();
    const scored: { s: StationMapEntry; score: number }[] = [];
    for (const s of stations) {
        if (onlyTroncal && s.sistema !== 'TransMilenio') continue;
        const name = normalizeText(s.nombre);
        const code = s.codigo.toLowerCase();
        let score = -1;
        if (name === q || code === q) score = 100;
        else if (name.startsWith(q)) score = 80;
        else if (name.includes(q)) score = 60;
        else if (code.startsWith(q)) score = 50;
        if (score < 0) continue;
        // Troncal stations first: they are what people usually mean
        if (s.sistema === 'TransMilenio') score += 15;
        scored.push({ s, score });
    }
    return scored.sort((a, b) => b.score - a.score).slice(0, limit).map((x) => x.s);
}

export async function nearestStations(lat: number, lng: number, limit = 5, sistema?: string): Promise<(StationMapEntry & { distanceM: number })[]> {
    const stations = await getStations();
    return stations
        .filter((s) => !sistema || s.sistema === sistema)
        .map((s) => ({ ...s, distanceM: haversine({ lat, lng }, s) }))
        .sort((a, b) => a.distanceM - b.distanceM)
        .slice(0, limit);
}

// ─── Routes ──────────────────────────────────────────────

export async function searchRoutes(search: string, tipoRuta = 'TIPORUTA'): Promise<RouteSearchResult[]> {
    const data = await loader<{ lista_rutas?: RouteSearchResult[] }>('searchRutaByTipo', { tipo_ruta: tipoRuta, search });
    return Array.isArray(data.lista_rutas) ? data.lista_rutas : [];
}

export async function routesAtStation(stationId: string): Promise<RouteSearchResult[]> {
    const data = await loader<{ lista_rutas?: RouteSearchResult[] }>('searchRutasByEstacionTroncales', { estacion: stationId });
    const list = Array.isArray(data.lista_rutas) ? data.lista_rutas : [];
    return list.filter((r, i, arr) => arr.findIndex((x) => x.id === r.id) === i);
}

interface RawRouteInfo {
    '0'?: {
        codigo: string;
        tipoServicio: string;
        horarios?: { data?: { convencion: string; hora_inicio: string; hora_fin: string }[] };
        color: string;
        sistema: string;
        id: string;
        nombre: string;
        trazado?: string;
    };
    recorrido?: {
        data?: {
            codigo: string;
            coordenada: string;
            direccion: string;
            estadoNodo: string;
            id: string;
            nombre: string;
            posicion: number;
            sistema: string;
            tipo_parada?: string;
            vagon?: string;
        }[];
    };
}

export async function getRouteDetail(idRuta: string, nombre: string, codigo: string): Promise<RouteDetailNormalized> {
    const raw = await loader<RawRouteInfo>('infoRuta', { idRuta, nombre, codigo }, 3600);
    const info = raw['0'];
    const stops = (raw.recorrido?.data || [])
        .map((s) => {
            const c = parseCoord(s.coordenada);
            if (!c) return null;
            return {
                id: s.id,
                code: s.codigo,
                name: s.nombre,
                address: s.direccion,
                lat: c.lat,
                lng: c.lng,
                position: Number(s.posicion) || 0,
                platform: s.vagon || undefined,
                active: (s.estadoNodo || 'ACTIVO').toUpperCase() === 'ACTIVO',
                isPortal: /portal/i.test(s.nombre) || s.tipo_parada === '3',
            };
        })
        .filter((s): s is NonNullable<typeof s> => s !== null);

    let geometry: LngLat[] = [];
    if (info?.trazado) {
        try {
            const parsed = JSON.parse(info.trazado) as { type: string; coordinates: LngLat[] | LngLat[][] };
            const coords = parsed.type === 'MultiLineString' ? (parsed.coordinates as LngLat[][]).flat() : (parsed.coordinates as LngLat[]);
            geometry = simplify(coords, 0.00002);
        } catch { /* fall back to stops */ }
    }
    if (geometry.length < 2) geometry = stops.map((s) => [s.lng, s.lat] as LngLat);

    return {
        id: info?.id || idRuta,
        code: info?.codigo || codigo,
        name: info?.nombre || nombre,
        color: colorForRouteCode(info?.codigo || codigo, info?.color),
        system: info?.sistema || '',
        serviceType: info?.tipoServicio || '',
        schedules: info?.horarios?.data || [],
        stops,
        geometry,
    };
}

// ─── Live buses & ETAs ───────────────────────────────────

const normalizeOccupancy = (v?: string): Occupancy => {
    const s = (v || '').toUpperCase();
    if (s.startsWith('VAC')) return 'VACIO';
    if (s.startsWith('MED')) return 'MEDIO';
    if (s.startsWith('LLE')) return 'LLENO';
    return 'DESCONOCIDO';
};

interface RawBus {
    id: string;
    latitude: number;
    longitude: number;
    label: string;
    lasttime: string;
    destino_limpio: string;
    posicion: number;
    angulo: number;
    accesibilidad?: string;
    ocupacion_bus?: string;
    nombre_estado?: string;
}

export async function getLiveBuses(codigo: string, nombre: string): Promise<LiveBus[]> {
    const data = await bodega<RawBus[] | { error?: string }>('buses', { method: 'POST', body: { ruta: codigo, Nombre: nombre } });
    if (!Array.isArray(data)) return [];
    return data
        .filter((b) => Number.isFinite(b.latitude) && Number.isFinite(b.longitude) && b.latitude !== 0)
        .map((b) => ({
            id: String(b.id),
            label: b.label,
            lat: b.latitude,
            lng: b.longitude,
            bearing: Number(b.angulo) || 0,
            destination: b.destino_limpio || '',
            occupancy: normalizeOccupancy(b.ocupacion_bus),
            accessibility: b.accesibilidad || '',
            status: b.nombre_estado || '',
            lastSeen: b.lasttime || '',
            position: Number(b.posicion) || 0,
        }));
}

interface RawEta {
    vehicleid: number;
    etiqueta: string;
    acessiblidad?: string;
    ocupacion_bus?: string;
    estadobus?: string;
    longitud: number;
    latitud: number;
    time: number;
    distancia: number;
    destino_limpio: string;
}

export async function getStopEtas(estacion: string, ruta: string, idRuta: string, nombre: string): Promise<StopEta[]> {
    const data = await bodega<RawEta[] | unknown>('getServicios', {
        method: 'POST',
        body: { estacion, ruta, idRuta, Nombre: nombre, Distancia: '100' },
    });
    if (!Array.isArray(data)) return [];
    return (data as RawEta[])
        .map((e) => ({
            vehicleId: e.vehicleid,
            label: e.etiqueta,
            minutes: Math.max(0, Math.round(Number(e.time) || 0)),
            distanceM: Number(e.distancia) || 0,
            occupancy: normalizeOccupancy(e.ocupacion_bus || e.estadobus),
            accessibility: e.acessiblidad || '',
            destination: e.destino_limpio || '',
            lat: e.latitud,
            lng: e.longitud,
        }))
        .sort((a, b) => a.minutes - b.minutes);
}

interface RawArrival {
    ruta_sae: number;
    ruta_extraida: string;
    destino_limpio: string;
    labelparadero: string;
    labeltiempo: string;
    color_ruta: string;
    color_texto: string;
}

function minutesFromLabel(label: string): number | null {
    const l = label.toLowerCase();
    if (l.includes('llegando')) return 0;
    const nums = l.match(/\d+/g);
    if (nums?.length) return parseInt(nums[0]);
    return null;
}

export async function getArrivals(paradero: string): Promise<Arrival[]> {
    const data = await bodega<RawArrival[] | unknown>('paradero/buses', { method: 'POST', body: { paradero } });
    if (!Array.isArray(data)) return [];
    return (data as RawArrival[])
        .map((a) => {
            const color = colorForRouteCode(a.ruta_extraida, a.color_ruta);
            return {
                routeId: a.ruta_sae,
                code: a.ruta_extraida,
                destination: a.destino_limpio,
                label: a.labeltiempo,
                minutes: minutesFromLabel(a.labeltiempo),
                distanceLabel: a.labelparadero,
                color,
                textColor: readableOn(color),
            };
        })
        .sort((a, b) => (a.minutes ?? 99) - (b.minutes ?? 99));
}

// ─── Service points (recharge / personalization) ─────────

interface RawPoint {
    nombre: string;
    direccion: string;
    latitud: number;
    longitud: number;
    localidad: string;
    wks: string;
    exs: string;
    hds: string;
}

export function getServicePoints(kind: 'recarga' | 'personalizacion'): Promise<ServicePoint[]> {
    return cached(`points:${kind}`, 12 * 60 * 60 * 1000, async () => {
        const data = await bodega<RawPoint[]>(kind === 'recarga' ? 'puntos_recarga' : 'puntos_personalizacion');
        if (!Array.isArray(data)) return [];
        return data
            .filter((p) => Number.isFinite(p.latitud) && Number.isFinite(p.longitud) && p.latitud !== 0)
            .map((p) => ({
                name: (p.nombre || '').trim(),
                address: (p.direccion || '').trim(),
                lat: +p.latitud.toFixed(6),
                lng: +p.longitud.toFixed(6),
                locality: p.localidad || '',
                hours: { wk: p.wks || '', sat: p.exs || '', hol: p.hds || '' },
            }));
    });
}

export async function nearestServicePoints(kind: 'recarga' | 'personalizacion', lat: number, lng: number, limit = 5): Promise<ServicePoint[]> {
    const points = await getServicePoints(kind);
    return points
        .map((p) => ({ ...p, distanceM: haversine({ lat, lng }, p) }))
        .sort((a, b) => a.distanceM! - b.distanceM!)
        .slice(0, limit);
}

// ─── Fare (from the official app's help file) ────────────

export function getFare(): Promise<number> {
    return cached('fare', 24 * 60 * 60 * 1000, async () => {
        try {
            const res = await fetch('https://firebasestorage.googleapis.com/v0/b/transmilenio-transmiapp.appspot.com/o/info.json?alt=media', {
                next: { revalidate: 86400 },
                signal: AbortSignal.timeout(8000),
            });
            const text = await res.text();
            const match = text.match(/TransMilenio\s*:\s*<\/strong>\s*([\d.]+)/i);
            const value = match ? parseInt(match[1].replace(/\./g, '')) : NaN;
            return Number.isFinite(value) && value > 1000 ? value : 3550;
        } catch {
            return 3550;
        }
    });
}

// ─── Trip planner (OpenTripPlanner) ──────────────────────

interface RawStop {
    code: string;
    name: string;
    id: string;
    location: { lat: number; lng: number };
}

interface RawStep {
    duration: { text: string };
    distance: { text: string };
    travel_mode: 'WALKING' | 'TRANSIT';
    html_instructions: string;
    start_location: { lat: number; lng: number };
    end_location: { lat: number; lng: number };
    geometry?: { coordinates: LngLat[] };
    transit_details?: {
        intermediate_stops?: RawStop[];
        num_nodos_suspendidos?: number;
        line?: { color: string; name: string; short_name: string; agencies?: { name: string }[]; id: string; long_name: string };
        departure_stop?: RawStop;
        arrival_stop?: RawStop;
    };
}

interface RawPlan {
    data?: {
        routes?: {
            legs: {
                durationValue: number;
                walkDistanceMeters: number;
                transferencias: number;
                steps: RawStep[];
            }[];
        }[];
    };
}

const parseMinutes = (text: string) => {
    const h = text.match(/(\d+)\s*h/);
    const m = text.match(/(\d+)\s*min/);
    return (h ? parseInt(h[1]) * 60 : 0) + (m ? parseInt(m[1]) : 0) || 1;
};

const parseMeters = (text: string) => {
    const km = text.match(/([\d.]+)\s*km/);
    if (km) return Math.round(parseFloat(km[1]) * 1000);
    const m = text.match(/([\d.]+)\s*m/);
    return m ? Math.round(parseFloat(m[1])) : 0;
};

const stripHtml = (s: string) => s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

function toStop(raw: RawStop | undefined, fallback: { lat: number; lng: number }, fallbackName: string): PlanStop {
    if (!raw) return { id: '', code: '', name: fallbackName, lat: fallback.lat, lng: fallback.lng };
    return { id: raw.id, code: raw.code, name: raw.name, lat: raw.location.lat, lng: raw.location.lng };
}

function lineKind(agency: string, code: string): PlanLine['kind'] {
    const a = agency.toLowerCase();
    if (a.includes('cable')) return 'cable';
    if (a.includes('troncal')) return 'troncal';
    if (a.includes('alimenta')) return 'alimentador';
    if (/^[A-Z]\d/i.test(code) && !a.includes('zonal')) return 'troncal';
    return 'zonal';
}

/**
 * The planner only sends placeholder colors (#ff0000 troncal, #0000ff zonal),
 * so colors come from the route code and service type instead.
 */
function lineColor(kind: PlanLine['kind'], code: string): string {
    if (kind === 'cable') return TRONCAL_COLORS.T;
    if (kind === 'alimentador') return '#5BA33B';
    if (kind === 'zonal') return ZONAL_BLUE;
    const letter = code.trim().charAt(0).toUpperCase();
    // Numbered "rutas fáciles" have no troncal letter
    return /^[A-Z]\d/i.test(code.trim()) && TRONCAL_COLORS[letter] ? TRONCAL_COLORS[letter] : '#404040';
}

export async function planTrip(from: PlanPlace, to: PlanPlace, opts: { date?: string; time?: string } = {}): Promise<Itinerary[]> {
    const params: Record<string, string> = {
        origen: `${from.lat.toFixed(6)},${from.lng.toFixed(6)}`,
        destino: `${to.lat.toFixed(6)},${to.lng.toFixed(6)}`,
    };
    if (opts.date) params.date = opts.date;
    if (opts.time) params.time = opts.time;

    const raw = await planner<RawPlan>(params);
    const routes = raw.data?.routes || [];

    const itineraries: Itinerary[] = routes.map((r, idx) => {
        const leg = r.legs[0];
        const legs: PlanLeg[] = leg.steps.map((s, i) => {
            const isLast = i === leg.steps.length - 1;
            const geometry = simplify(s.geometry?.coordinates || [[s.start_location.lng, s.start_location.lat], [s.end_location.lng, s.end_location.lat]]);
            if (s.travel_mode === 'TRANSIT' && s.transit_details?.line) {
                const td = s.transit_details;
                const line = td.line!;
                const agency = line.agencies?.[0]?.name || '';
                const code = line.short_name || line.name;
                const kind = lineKind(agency, code);
                const color = lineColor(kind, code);
                return {
                    mode: 'TRANSIT' as const,
                    durationMin: parseMinutes(s.duration.text),
                    distanceM: parseMeters(s.distance.text),
                    distanceText: s.distance.text,
                    from: toStop(td.departure_stop, s.start_location, 'Salida'),
                    to: toStop(td.arrival_stop, s.end_location, 'Llegada'),
                    geometry,
                    line: { id: line.id, code, name: line.name, longName: line.long_name, color, agency, kind },
                    stops: (td.intermediate_stops || []).map((st) => toStop(st, st.location, st.name)),
                    suspendedStops: td.num_nodos_suspendidos || 0,
                };
            }
            const target = isLast ? to.name : stripHtml(s.html_instructions || '');
            return {
                mode: 'WALK' as const,
                durationMin: parseMinutes(s.duration.text),
                distanceM: parseMeters(s.distance.text),
                distanceText: s.distance.text,
                from: { id: '', code: '', name: i === 0 ? from.name : 'Bajada', lat: s.start_location.lat, lng: s.start_location.lng },
                to: { id: '', code: '', name: target || 'Destino', lat: s.end_location.lat, lng: s.end_location.lng },
                geometry,
            };
        });

        const all = legs.flatMap((l) => l.geometry);
        const walkMeters = Math.round(leg.walkDistanceMeters || 0);
        return {
            id: `it-${idx}`,
            durationMin: Math.round((leg.durationValue || 0) / 60) || legs.reduce((s, l) => s + l.durationMin, 0),
            walkMeters,
            walkMin: legs.filter((l) => l.mode === 'WALK').reduce((s, l) => s + l.durationMin, 0),
            // Upstream 'transferencias' counts boardings (1 for a direct ride); derive real transfers from the legs
            transfers: Math.max(0, legs.filter((l) => l.mode === 'TRANSIT').length - 1),
            legs,
            bounds: boundsOf(all),
            tags: [] as ItineraryTag[],
        };
    });

    if (itineraries.length) {
        const by = <K extends keyof Itinerary>(k: K) => itineraries.reduce((best, it) => ((it[k] as number) < (best[k] as number) ? it : best));
        by('durationMin').tags.push('fastest');
        const fewest = by('transfers');
        if (itineraries.filter((i) => i.transfers === fewest.transfers).length < itineraries.length) fewest.tags.push('fewest-transfers');
        const leastWalk = by('walkMeters');
        if (leastWalk.walkMeters < by('durationMin').walkMeters) leastWalk.tags.push('least-walking');
    }

    return itineraries.sort((a, b) => a.durationMin - b.durationMin);
}

// ─── Geocoding (Photon / OpenStreetMap + our stations) ───

interface PhotonFeature {
    geometry: { coordinates: LngLat };
    properties: {
        name?: string;
        street?: string;
        housenumber?: string;
        locality?: string;
        district?: string;
        city?: string;
        osm_value?: string;
    };
}

const PHOTON = 'https://photon.komoot.io';

function photonToPlace(f: PhotonFeature): PlanPlace | null {
    const p = f.properties;
    const [lng, lat] = f.geometry.coordinates;
    const street = [p.street, p.housenumber].filter(Boolean).join(' # ');
    const name = p.name || street;
    if (!name) return null;
    const detail = [p.name ? street : '', p.locality || p.district, p.city !== 'Bogotá' ? p.city : ''].filter(Boolean).join(', ');
    return { name, detail: detail || 'Bogotá', lat, lng, kind: 'place' };
}

export async function searchPlaces(query: string, near?: { lat: number; lng: number }): Promise<PlanPlace[]> {
    const q = query.trim();
    if (q.length < 2) return [];
    const [minLng, minLat, maxLng, maxLat] = BOGOTA_BBOX;
    const params = new URLSearchParams({ q, limit: '8', bbox: `${minLng},${minLat},${maxLng},${maxLat}` });
    params.set('lat', String(near?.lat ?? 4.65));
    params.set('lon', String(near?.lng ?? -74.1));

    const [stations, places] = await Promise.all([
        findStations(q, 4, true).catch(() => []),
        cached(`photon:${params.toString()}`, 10 * 60 * 1000, async () => {
            const res = await fetch(`${PHOTON}/api/?${params.toString()}`, {
                headers: { 'User-Agent': 'TransMi/3 (educational project)' },
                signal: AbortSignal.timeout(8000),
            });
            if (!res.ok) return [] as PlanPlace[];
            const data = (await res.json()) as { features?: PhotonFeature[] };
            const seen = new Set<string>();
            return (data.features || [])
                .map(photonToPlace)
                .filter((p): p is PlanPlace => {
                    if (!p) return false;
                    const key = `${p.name}|${p.detail}`;
                    if (seen.has(key)) return false;
                    seen.add(key);
                    return true;
                });
        }).catch(() => [] as PlanPlace[]),
    ]);

    const stationPlaces: PlanPlace[] = stations.map((s) => ({
        name: s.nombre,
        detail: `Estación · ${s.direccion}`,
        lat: s.lat,
        lng: s.lng,
        kind: 'station',
    }));
    return [...stationPlaces, ...places].slice(0, 10);
}

export async function reverseGeocode(lat: number, lng: number): Promise<PlanPlace> {
    try {
        const res = await fetch(`${PHOTON}/reverse?lat=${lat}&lon=${lng}&limit=1`, {
            headers: { 'User-Agent': 'TransMi/3 (educational project)' },
            next: { revalidate: 3600 },
            signal: AbortSignal.timeout(6000),
        });
        const data = (await res.json()) as { features?: PhotonFeature[] };
        const place = data.features?.[0] ? photonToPlace(data.features[0]) : null;
        if (place) return { ...place, lat, lng };
    } catch { /* fall through */ }
    return { name: 'Punto en el mapa', detail: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, lat, lng, kind: 'map' };
}

// ─── Weather (Open-Meteo, no key) ────────────────────────

const WEATHER_TEXT: [number[], string][] = [
    [[0], 'Despejado'],
    [[1, 2], 'Parcialmente nublado'],
    [[3], 'Nublado'],
    [[45, 48], 'Niebla'],
    [[51, 53, 55, 56, 57], 'Llovizna'],
    [[61, 63, 65, 66, 67, 80, 81, 82], 'Lluvia'],
    [[95, 96, 99], 'Tormenta'],
];

export function weatherSummary(code: number): string {
    return WEATHER_TEXT.find(([codes]) => codes.includes(code))?.[1] || 'Variable';
}

interface RawWeather {
    current: { temperature_2m: number; weather_code: number; precipitation: number; is_day: number };
    minutely_15?: { time: string[]; precipitation: number[]; precipitation_probability?: number[] };
}

export async function getWeather(lat = 4.65, lng = -74.1): Promise<WeatherNow> {
    const key = `${lat.toFixed(2)},${lng.toFixed(2)}`;
    return cached(`weather:${key}`, 10 * 60 * 1000, async () => {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(3)}&longitude=${lng.toFixed(3)}&current=temperature_2m,weather_code,precipitation,is_day&minutely_15=precipitation,precipitation_probability&forecast_minutely_15=8&timezone=America%2FBogota`;
        const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (!res.ok) throw new Error(`weather ${res.status}`);
        const w = (await res.json()) as RawWeather;
        const precip = w.minutely_15?.precipitation || [];
        const prob = w.minutely_15?.precipitation_probability || [];
        let rainInMin: number | null = null;
        if (w.current.precipitation > 0.05) rainInMin = 0;
        else {
            const idx = precip.findIndex((p, i) => p >= 0.1 || (prob[i] ?? 0) >= 60);
            if (idx >= 0) rainInMin = idx * 15;
        }
        return {
            temperature: Math.round(w.current.temperature_2m),
            code: w.current.weather_code,
            isDay: w.current.is_day === 1,
            precipitation: w.current.precipitation,
            rainInMin,
            rainProbability: Math.max(0, ...prob.slice(0, 8)),
            summary: weatherSummary(w.current.weather_code),
        };
    });
}
