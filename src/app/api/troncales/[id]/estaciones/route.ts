import { loader } from '@/lib/server/upstream';
import { respond } from '@/lib/server/respond';
import { getStations } from '@/lib/server/transit';
import { orderAlongLine } from '@/lib/geo';
import type { Estacion } from '@/types/explorar';

// GET /api/troncales/:id/estaciones — stations of a troncal, in line order, with coordinates.
// The upstream list is alphabetical and has no coordinates; we join them from the stations catalog.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return respond('las estaciones de la troncal', async () => {
        const [data, stations] = await Promise.all([
            loader<{ lista_estaciones?: Estacion[] }>('estacionesByTroncal', { troncal: id }, 3600),
            getStations().catch(() => []),
        ]);
        const byCode = new Map(stations.map((s) => [s.codigo, s]));
        const list = (data.lista_estaciones || []).map((e) => {
            const s = byCode.get(e.codigo);
            return s ? { ...e, coordenada: e.coordenada || `${s.lat},${s.lng}` } : e;
        });
        const ordered = orderAlongLine(list, (e) => {
            const s = byCode.get(e.codigo);
            return s ? { lat: s.lat, lng: s.lng } : null;
        });
        return { lista_estaciones: ordered };
    }, 3600);
}
