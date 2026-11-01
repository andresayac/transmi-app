import { NextResponse } from 'next/server';
import { getSharedTrip, updateSchema, updateSharedTrip } from '@/lib/server/sharedTrips';

export const runtime = 'nodejs';

const noStore = { 'Cache-Control': 'no-store' };

// GET /api/sigue/:id            → { trip, state }
// GET /api/sigue/:id?estado=1   → { state } (what followers poll)
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const shared = await getSharedTrip(id);
    if (!shared) return NextResponse.json({ error: 'Este enlace no existe o ya expiró' }, { status: 404, headers: noStore });
    const onlyState = new URL(request.url).searchParams.get('estado') === '1';
    return NextResponse.json(onlyState ? { state: shared.state } : shared, { headers: noStore });
}

// PUT /api/sigue/:id { key, leg, bus, eta, ended?, by? } — progress from the sender's phone
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const parsed = updateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Actualización inválida' }, { status: 400 });

    const result = await updateSharedTrip(id, parsed.data);
    const status = { ok: 200, too_soon: 200, not_found: 404, forbidden: 403, closed: 410 }[result];
    return NextResponse.json({ result }, { status, headers: noStore });
}
