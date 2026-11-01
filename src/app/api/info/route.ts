import { respond } from '@/lib/server/respond';
import { getFare } from '@/lib/server/transit';

// GET /api/info — system facts the UI needs (currently the fare)
export async function GET() {
    return respond('la información del sistema', async () => ({ fare: await getFare() }), 86400);
}
