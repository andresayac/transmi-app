import { NextResponse } from 'next/server';
import { createSharedTrip, parseTrip } from '@/lib/server/sharedTrips';
import { clientIp, rateLimit } from '@/lib/server/rateLimit';

export const runtime = 'nodejs';

const allowed = rateLimit('sigue', 10 * 60 * 1000, 30);

// POST /api/sigue { trip } → { id, key }: short link for "Sigue mi viaje"
export async function POST(request: Request) {
    if (!allowed(clientIp(request))) return NextResponse.json({ error: 'Demasiados enlaces seguidos. Intenta en unos minutos.' }, { status: 429 });

    const raw = await request.text();
    if (raw.length > 64 * 1024) return NextResponse.json({ error: 'El viaje es demasiado grande' }, { status: 413 });
    let body: { trip?: unknown } | null = null;
    try { body = JSON.parse(raw); } catch { /* invalid JSON */ }
    const trip = parseTrip(body?.trip);
    if (!trip) return NextResponse.json({ error: 'Viaje inválido' }, { status: 400 });

    try {
        const created = await createSharedTrip(trip);
        return NextResponse.json(created, { headers: { 'Cache-Control': 'no-store' } });
    } catch (err) {
        console.error('[sigue] no se pudo guardar el viaje', err instanceof Error ? err.message : err);
        return NextResponse.json({ error: 'No se pudo crear el enlace' }, { status: 500 });
    }
}
