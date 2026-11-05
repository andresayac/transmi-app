import { respond } from '@/lib/server/respond';
import { getTroncalStations } from '@/lib/server/transit';

// GET /api/troncales/:id/estaciones — stations of a troncal, in line order, with coordinates
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return respond('las estaciones de la troncal', async () => ({ lista_estaciones: await getTroncalStations(id) }), 3600);
}
