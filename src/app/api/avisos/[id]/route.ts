import { NextResponse } from 'next/server';
import { updateSchema, updateWatch } from '@/lib/server/tripAlerts/store';

export const runtime = 'nodejs';

// PUT /api/avisos/:id { key, leg, bus, visible, fired, alarmStops, ended? } → { result, fired }
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const parsed = updateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Actualización inválida' }, { status: 400 });

    const outcome = await updateWatch(id, parsed.data);
    const status = { ok: 200, ended: 200, not_found: 404, forbidden: 403 }[outcome.result];
    return NextResponse.json(outcome, { status, headers: { 'Cache-Control': 'no-store' } });
}
