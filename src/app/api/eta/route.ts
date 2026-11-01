import { badRequest, respond } from '@/lib/server/respond';
import { getStopEtas } from '@/lib/server/transit';

// GET /api/eta?estacion=TM0002&ruta=6&idRuta=5709&nombre=Calle 72 — next buses of one route at one stop
export async function GET(request: Request) {
    const { searchParams: q } = new URL(request.url);
    const estacion = q.get('estacion'), ruta = q.get('ruta'), idRuta = q.get('idRuta');
    if (!estacion || !ruta || !idRuta) return badRequest('Faltan estacion, ruta o idRuta');
    return respond('el tiempo de llegada', async () => ({
        etas: await getStopEtas(estacion, ruta, idRuta, q.get('nombre') || ''),
        updatedAt: new Date().toISOString(),
    }));
}
