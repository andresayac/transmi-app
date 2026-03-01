import { NextResponse } from 'next/server';

const PROXY_BASE = process.env.PROXY_BASE || '';
const BUS_API_URL = 'https://tmsa-transmiapp-shvpc.uc.r.appspot.com/buses';

// Log proxy configuration on startup
console.log(`[buses] PROXY_BASE=${PROXY_BASE ? 'configured ✓' : 'NOT SET — calling API directly'}`);

const BUS_HEADERS: Record<string, string> = {
    'x-auth-token': '9FD3akHPaMmAH9iCE82ks4OD6CsUdyd7oppY256Hv6s5mOfxIOZummlpJUBXrjIx',
    'Host': 'tmsa-transmiapp-shvpc.uc.r.appspot.com',
    'Appid': '9a2c3b48f0c24ae9bfba38e94f27c3ea',
    'uuid': '951d0eaf-daaf-464f-8baf-1d00fe09a01b',
    'version': '2.7.6',
    'Content-Type': 'application/json',
};

export async function POST(request: Request) {
    const { searchParams } = new URL(request.url);
    const ruta = searchParams.get('ruta') || '';
    const nombre = searchParams.get('nombre') || '';

    if (!ruta) {
        return NextResponse.json({ error: 'Missing ruta parameter' }, { status: 400 });
    }

    const fetchUrl = PROXY_BASE
        ? `${PROXY_BASE}?url=${encodeURIComponent(BUS_API_URL)}`
        : BUS_API_URL;

    try {
        const response = await fetch(fetchUrl, {
            method: 'POST',
            headers: BUS_HEADERS,
            body: JSON.stringify({ ruta, Nombre: nombre }),
        });

        const data = await response.json();
        return NextResponse.json(data, { status: response.status });
    } catch (error) {
        console.error('Error getting bus locations:', error);
        return NextResponse.json({ error: 'Failed to get bus locations' }, { status: 500 });
    }
}
