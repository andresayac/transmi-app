import { badRequest, num, respond } from '@/lib/server/respond';
import { reverseGeocode } from '@/lib/server/transit';

// GET /api/geocode/reverse?lat&lng
export async function GET(request: Request) {
    const { searchParams: q } = new URL(request.url);
    const lat = num(q.get('lat')), lng = num(q.get('lng'));
    if (lat === null || lng === null) return badRequest('Faltan coordenadas');
    return respond('la dirección', () => reverseGeocode(lat, lng), 3600);
}
