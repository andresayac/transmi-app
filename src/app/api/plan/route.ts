import { badRequest, num, respond } from '@/lib/server/respond';
import { planTrip } from '@/lib/server/transit';
import type { PlanPlace, PlanResponse } from '@/types/transit';

// GET /api/plan?fromLat&fromLng&fromName&toLat&toLng&toName[&date=MM-DD-YYYY&time=HH:mm]
export async function GET(request: Request) {
    const { searchParams: q } = new URL(request.url);
    const fromLat = num(q.get('fromLat')), fromLng = num(q.get('fromLng'));
    const toLat = num(q.get('toLat')), toLng = num(q.get('toLng'));
    if (fromLat === null || fromLng === null || toLat === null || toLng === null) {
        return badRequest('Faltan las coordenadas de origen o destino');
    }

    const from: PlanPlace = { name: q.get('fromName') || 'Origen', lat: fromLat, lng: fromLng };
    const to: PlanPlace = { name: q.get('toName') || 'Destino', lat: toLat, lng: toLng };

    return respond('el plan de viaje', async (): Promise<PlanResponse> => {
        const itineraries = await planTrip(from, to, {
            date: q.get('date') || undefined,
            time: q.get('time') || undefined,
        });
        return { itineraries, from, to, requestedAt: new Date().toISOString() };
    }, 60);
}
