import { NextResponse } from 'next/server';

const TM_API_BASE = 'https://api.buscador-rutas.transmilenio.gov.co/loader.php';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const idRuta = searchParams.get('idRuta') || '';
    const nombre = searchParams.get('nombre') || '';
    const codigo = searchParams.get('codigo') || '';

    const url = `${TM_API_BASE}?lServicio=Rutas&lTipo=api&lFuncion=infoRuta&idRuta=${encodeURIComponent(idRuta)}&nombre=${encodeURIComponent(nombre)}&codigo=${encodeURIComponent(codigo)}`;

    try {
        const response = await fetch(url, {
            next: { revalidate: 300 }, // 5 min server cache
        });

        const data = await response.json();
        return NextResponse.json(data, {
            status: response.status,
            headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
        });
    } catch (error) {
        console.error('Error getting route info:', error);
        return NextResponse.json({ error: 'Failed to get route info' }, { status: 500 });
    }
}
