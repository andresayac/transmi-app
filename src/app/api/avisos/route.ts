import { NextResponse } from 'next/server';
import { createSchema, createWatch } from '@/lib/server/tripAlerts/store';
import { vapidKeys } from '@/lib/server/tripAlerts/push';
import { clientIp, rateLimit } from '@/lib/server/rateLimit';

export const runtime = 'nodejs';

const noStore = { 'Cache-Control': 'no-store' };
const allowed = rateLimit('avisos', 10 * 60 * 1000, 30);

// GET /api/avisos → { publicKey }: what the phone subscribes to push notifications with
export async function GET() {
    try {
        const { publicKey } = await vapidKeys();
        return NextResponse.json({ publicKey }, { headers: noStore });
    } catch (err) {
        console.error('[avisos] sin llaves VAPID', err instanceof Error ? err.message : err);
        return NextResponse.json({ error: 'Los avisos no están disponibles' }, { status: 503, headers: noStore });
    }
}

// POST /api/avisos { subscription, trip, leg, bus, alarmStops } → { id, key }
export async function POST(request: Request) {
    if (!allowed(clientIp(request))) return NextResponse.json({ error: 'Demasiados intentos. Intenta en unos minutos.' }, { status: 429 });

    const raw = await request.text();
    if (raw.length > 64 * 1024) return NextResponse.json({ error: 'El viaje es demasiado grande' }, { status: 413 });
    let body: unknown = null;
    try { body = JSON.parse(raw); } catch { /* invalid JSON */ }
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });

    try {
        const created = await createWatch(parsed.data, request.headers.get('origin') ?? undefined);
        if (created === 'full') return NextResponse.json({ error: 'Los avisos están llenos. Intenta más tarde.' }, { status: 503 });
        return NextResponse.json(created, { headers: noStore });
    } catch (err) {
        console.error('[avisos] no se pudo guardar el viaje', err instanceof Error ? err.message : err);
        return NextResponse.json({ error: 'No se pudieron activar los avisos' }, { status: 500 });
    }
}
