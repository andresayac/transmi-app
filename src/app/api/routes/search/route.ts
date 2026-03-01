import { NextResponse } from 'next/server';

const TM_API_BASE = 'https://api.buscador-rutas.transmilenio.gov.co/loader.php';
const TM_HEADERS = [
    'Host: api.buscador-rutas.transmilenio.gov.co',
    'Appid: 9a2c3b48f0c24ae9bfba38e94f27c3ea',
    'Accept-Encoding: gzip',
    'User-Agent: okhttp/4.12.0',
    'uuid: 951d0eaf-daaf-464f-8baf-1d00fe09a01b',
    'version: 2.7.6',
    'Content-Type: application/json',
];

function buildHeaders(): HeadersInit {
    const headers: Record<string, string> = {};
    TM_HEADERS.forEach((h) => {
        const [key, ...rest] = h.split(': ');
        headers[key] = rest.join(': ');
    });
    return headers;
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const tipoRuta = searchParams.get('tipoRuta') || 'TIPORUTA';

    const url = `${TM_API_BASE}?lServicio=Rutas&lTipo=api&lFuncion=searchRutaByTipo&tipo_ruta=${encodeURIComponent(tipoRuta)}&search=${encodeURIComponent(search)}`;

    try {
        const response = await fetch(url, {
            headers: buildHeaders(),
            next: { revalidate: 300 }, // 5 min server cache
        });

        const data = await response.json();
        return NextResponse.json(data, {
            status: response.status,
            headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
        });
    } catch (error) {
        console.error('Error searching routes:', error);
        return NextResponse.json({ error: 'Failed to search routes' }, { status: 500 });
    }
}
