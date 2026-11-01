import { badRequest, respond } from '@/lib/server/respond';
import { getArrivals } from '@/lib/server/transit';
import type { ArrivalsResponse } from '@/types/transit';

// GET /api/llegadas?paradero=TM0002 — live arrivals for every route at a station or zonal stop
export async function GET(request: Request) {
    const paradero = new URL(request.url).searchParams.get('paradero')?.trim();
    if (!paradero) return badRequest('Falta el código del paradero');
    return respond('las llegadas', async (): Promise<ArrivalsResponse> => ({
        stop: paradero,
        arrivals: await getArrivals(paradero),
        updatedAt: new Date().toISOString(),
    }));
}
