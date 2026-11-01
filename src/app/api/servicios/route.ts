import { bodega } from '@/lib/server/upstream';
import { respond } from '@/lib/server/respond';

// POST /api/servicios { estacion, ruta, idRuta, Nombre } — raw ETAs (kept for backwards compatibility; see /api/eta)
export async function POST(request: Request) {
    const body = await request.json().catch(() => ({}));
    const { estacion, ruta, idRuta, Nombre, Distancia = '100' } = body as Record<string, string>;
    return respond('el tiempo de llegada', () =>
        bodega('getServicios', { method: 'POST', body: { estacion, ruta, idRuta, Nombre, Distancia } }),
    );
}
