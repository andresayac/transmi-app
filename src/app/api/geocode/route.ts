import { badRequest, num, respond } from '@/lib/server/respond';
import { searchPlaces } from '@/lib/server/transit';

// GET /api/geocode?q=movistar arena[&lat&lng]
export async function GET(request: Request) {
    const { searchParams: q } = new URL(request.url);
    const query = (q.get('q') || '').trim();
    if (query.length < 2) return badRequest('Escribe al menos 2 letras');
    const lat = num(q.get('lat')), lng = num(q.get('lng'));
    return respond('los lugares', async () => ({
        places: await searchPlaces(query, lat !== null && lng !== null ? { lat, lng } : undefined),
    }), 300);
}
