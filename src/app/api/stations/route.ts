import { respond } from '@/lib/server/respond';
import { getStations } from '@/lib/server/transit';

// GET /api/stations — every station and zonal stop with coordinates (server cache: 2h)
export async function GET() {
    return respond('las estaciones', async () => {
        const stations = await getStations();
        return { stations, count: stations.length };
    }, 7200);
}
