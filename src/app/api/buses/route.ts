import { NextResponse } from 'next/server';
import { bodega } from '@/lib/server/upstream';
import { respond } from '@/lib/server/respond';

// POST /api/buses?ruta=B23&nombre=Alcalá — raw bus positions (kept for backwards compatibility; see /api/live)
export async function POST(request: Request) {
    const { searchParams } = new URL(request.url);
    const ruta = searchParams.get('ruta') || '';
    const nombre = searchParams.get('nombre') || '';
    if (!ruta) return NextResponse.json({ error: 'Missing ruta parameter' }, { status: 400 });
    return respond('los buses', () => bodega('buses', { method: 'POST', body: { ruta, Nombre: nombre } }));
}
