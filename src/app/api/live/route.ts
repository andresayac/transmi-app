import { badRequest, respond } from '@/lib/server/respond';
import { getLiveBuses } from '@/lib/server/transit';

// GET /api/live?ruta=B23&nombre=Alcalá — normalized live buses with occupancy and bearing
export async function GET(request: Request) {
    const { searchParams: q } = new URL(request.url);
    const ruta = q.get('ruta')?.trim();
    if (!ruta) return badRequest('Falta el código de la ruta');
    return respond('los buses en vivo', async () => ({
        buses: await getLiveBuses(ruta, q.get('nombre') || ''),
        updatedAt: new Date().toISOString(),
    }));
}
