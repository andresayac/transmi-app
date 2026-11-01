import { badRequest, respond } from '@/lib/server/respond';
import { getRouteDetail } from '@/lib/server/transit';

// GET /api/routes/detail?id=321&nombre=Portal Eldorado&codigo=K23
// Normalized route: real geometry (trazado), stops with meters-along-route, schedules.
export async function GET(request: Request) {
    const { searchParams: q } = new URL(request.url);
    const id = q.get('id'), codigo = q.get('codigo');
    if (!id || !codigo) return badRequest('Faltan id o codigo de la ruta');
    return respond('la ruta', () => getRouteDetail(id, q.get('nombre') || '', codigo), 3600);
}
