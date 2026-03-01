import { NextResponse } from 'next/server';

const TM_API_BASE = 'https://api.buscador-rutas.transmilenio.gov.co/loader.php';
const HEADERS = {
    'User-Agent': 'okhttp/4.12.0',
    'uuid': '951d0eaf-daaf-464f-8baf-1d00fe09a01b',
    'version': '2.7.6',
};

// Server-side in-memory cache
let stationsCache: {
    data: StationEntry[];
    timestamp: number;
} | null = null;

const CACHE_TTL = 2 * 60 * 60 * 1000; // 2 hours

interface RawParada {
    id: string;
    codigo: string;
    nombre: string;
    nombreSinTilde: string;
    direccion: string;
    coordenada: string;
    sistema: string;
}

interface StationEntry {
    id: string;
    codigo: string;
    nombre: string;
    direccion: string;
    lat: number;
    lng: number;
    sistema: string;
}

async function fetchParadasByLetter(letter: string): Promise<RawParada[]> {
    const url = `${TM_API_BASE}?lServicio=Rutas&lTipo=api&lFuncion=getParaderosList&search=${letter}`;
    const response = await fetch(url, { headers: HEADERS });
    if (!response.ok) return [];
    const data = await response.json();
    return data.listParadas || [];
}

async function buildStationsCache(): Promise<StationEntry[]> {
    // Fetch with a few broad search terms to maximize coverage
    // "a" alone returns ~6700+ results, but some stations don't contain "a"
    const letters = ['a', 'e', 'o', 'portal', 'calle', 'carrera', 'estacion'];

    const allRaw = new Map<string, RawParada>();

    // Fetch in parallel (these are server-side calls)
    const results = await Promise.all(letters.map(fetchParadasByLetter));
    for (const batch of results) {
        for (const p of batch) {
            if (!allRaw.has(p.id)) allRaw.set(p.id, p);
        }
    }

    // Parse coordinates and filter invalid
    const stations: StationEntry[] = [];
    for (const p of allRaw.values()) {
        if (!p.coordenada) continue;
        const parts = p.coordenada.split(',');
        if (parts.length !== 2) continue;
        const lat = parseFloat(parts[0]);
        const lng = parseFloat(parts[1]);
        if (isNaN(lat) || isNaN(lng) || lat === 0) continue;

        stations.push({
            id: p.id,
            codigo: p.codigo,
            nombre: p.nombre,
            direccion: p.direccion,
            lat,
            lng,
            sistema: p.sistema,
        });
    }

    return stations;
}

export async function GET() {
    try {
        // Check in-memory cache
        if (stationsCache && (Date.now() - stationsCache.timestamp) < CACHE_TTL) {
            return NextResponse.json(
                { stations: stationsCache.data, cached: true, count: stationsCache.data.length },
                { headers: { 'Cache-Control': 'public, s-maxage=7200, stale-while-revalidate=14400' } },
            );
        }

        // Build fresh cache
        const stations = await buildStationsCache();

        stationsCache = { data: stations, timestamp: Date.now() };

        return NextResponse.json(
            { stations, cached: false, count: stations.length },
            { headers: { 'Cache-Control': 'public, s-maxage=7200, stale-while-revalidate=14400' } },
        );
    } catch (error) {
        console.error('Error building stations cache:', error);
        return NextResponse.json({ error: 'Failed to load stations' }, { status: 500 });
    }
}
