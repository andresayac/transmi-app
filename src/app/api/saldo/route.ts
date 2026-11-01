import { NextResponse } from 'next/server';
import { bodega } from '@/lib/server/upstream';
import { respond } from '@/lib/server/respond';

// POST /api/saldo { numero_tarjeta } — TuLlave card balance
export async function POST(request: Request) {
    const { numero_tarjeta } = await request.json().catch(() => ({ numero_tarjeta: '' }));
    if (!numero_tarjeta || !/^\d{8,20}$/.test(String(numero_tarjeta))) {
        return NextResponse.json({ error: 'Número de tarjeta requerido' }, { status: 400 });
    }
    return respond('el saldo', () => bodega('lectura_tarjeta', { method: 'POST', body: { numero_tarjeta: String(numero_tarjeta), consultar: 'true' } }));
}
