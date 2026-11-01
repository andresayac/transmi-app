import { num, respond } from '@/lib/server/respond';
import { getWeather } from '@/lib/server/transit';

// GET /api/clima[?lat&lng] — current weather and "rain in N minutes" for Bogotá
export async function GET(request: Request) {
    const { searchParams: q } = new URL(request.url);
    const lat = num(q.get('lat')) ?? 4.65;
    const lng = num(q.get('lng')) ?? -74.1;
    return respond('el clima', () => getWeather(lat, lng), 600);
}
