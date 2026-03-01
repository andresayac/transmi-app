import { NextResponse } from 'next/server';

const TM_API_BASE = 'https://api.buscador-rutas.transmilenio.gov.co/loader.php';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';

    if (!search.trim()) {
        return NextResponse.json({ listParadas: [] });
    }

    const url = `${TM_API_BASE}?lServicio=Rutas&lTipo=api&lFuncion=getParaderosList&search=${encodeURIComponent(search)}`;

    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'okhttp/4.12.0',
                'uuid': '951d0eaf-daaf-464f-8baf-1d00fe09a01b',
                'version': '2.7.6',
            },
            next: { revalidate: 300 },
        });

        const data = await response.json();
        return NextResponse.json(data, {
            headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
        });
    } catch (error) {
        console.error('Error searching paradas:', error);
        return NextResponse.json({ error: 'Failed to search paradas' }, { status: 500 });
    }
}
