import { NextResponse } from 'next/server';

const TM_API_BASE = 'https://api.buscador-rutas.transmilenio.gov.co/loader.php';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const url = `${TM_API_BASE}?lServicio=Rutas&lTipo=api&lFuncion=estacionesByTroncal&troncal=${encodeURIComponent(id)}`;

    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'okhttp/4.12.0',
                'uuid': '951d0eaf-daaf-464f-8baf-1d00fe09a01b',
                'version': '2.7.6',
            },
            next: { revalidate: 3600 },
        });

        const data = await response.json();
        return NextResponse.json(data, {
            headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' },
        });
    } catch (error) {
        console.error('Error fetching estaciones:', error);
        return NextResponse.json({ error: 'Failed to fetch estaciones' }, { status: 500 });
    }
}
