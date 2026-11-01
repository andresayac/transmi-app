import { NextResponse } from 'next/server';
import { createSharedTrip, parseTrip } from '@/lib/server/sharedTrips';

export const runtime = 'nodejs';

// Per-IP limit on new links: plenty for real trips, a wall for scripts filling the disk
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 30;
const g = globalThis as typeof globalThis & { __shareRate?: Map<string, { count: number; since: number }> };
const rate = (g.__shareRate ??= new Map());

function allowed(ip: string): boolean {
    const now = Date.now();
    const entry = rate.get(ip);
    if (!entry || now - entry.since > WINDOW_MS) {
        if (rate.size > 10000) rate.clear();
        rate.set(ip, { count: 1, since: now });
        return true;
    }
    entry.count++;
    return entry.count <= MAX_PER_WINDOW;
}

// POST /api/sigue { trip } → { id, key }: short link for "Sigue mi viaje"
export async function POST(request: Request) {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || request.headers.get('x-real-ip') || 'local';
    if (!allowed(ip)) return NextResponse.json({ error: 'Demasiados enlaces seguidos. Intenta en unos minutos.' }, { status: 429 });

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
