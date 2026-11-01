import { badRequest, num, respond } from '@/lib/server/respond';
import { getServicePoints, nearestServicePoints } from '@/lib/server/transit';

// GET /api/puntos?tipo=recarga|personalizacion            → GeoJSON for the map
// GET /api/puntos?tipo=recarga&lat&lng[&limit=5]          → nearest points list
export async function GET(request: Request) {
    const { searchParams: q } = new URL(request.url);
    const tipo = q.get('tipo');
    if (tipo !== 'recarga' && tipo !== 'personalizacion') return badRequest('tipo debe ser recarga o personalizacion');

    const lat = num(q.get('lat')), lng = num(q.get('lng'));
    if (lat !== null && lng !== null) {
        const limit = Math.min(20, Math.max(1, num(q.get('limit')) ?? 5));
        return respond('los puntos cercanos', async () => ({ points: await nearestServicePoints(tipo, lat, lng, limit) }), 600);
    }

    return respond('los puntos', async () => {
        const points = await getServicePoints(tipo);
        return {
            type: 'FeatureCollection',
            features: points.map((p) => ({
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
                properties: { n: p.name, a: p.address, l: p.locality, wk: p.hours.wk, sat: p.hours.sat, hol: p.hours.hol },
            })),
        };
    }, 43200);
}
