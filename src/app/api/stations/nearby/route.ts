import { badRequest, num, respond } from '@/lib/server/respond';
import { nearestStations } from '@/lib/server/transit';

// GET /api/stations/nearby?lat&lng[&limit=3&sistema=TransMilenio]
export async function GET(request: Request) {
    const { searchParams: q } = new URL(request.url);
    const lat = num(q.get('lat')), lng = num(q.get('lng'));
    if (lat === null || lng === null) return badRequest('Faltan coordenadas');
    const limit = Math.min(10, Math.max(1, num(q.get('limit')) ?? 3));
    return respond('las estaciones cercanas', async () => ({
        stations: await nearestStations(lat, lng, limit, q.get('sistema') || undefined),
    }), 60);
}
