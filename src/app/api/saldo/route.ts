import { NextResponse } from 'next/server';

const PROXY_BASE = process.env.PROXY_BASE || '';
const BUSES_API = 'https://tmsa-transmiapp-shvpc.uc.r.appspot.com';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { numero_tarjeta } = body;

        if (!numero_tarjeta) {
            return NextResponse.json({ error: 'Número de tarjeta requerido' }, { status: 400 });
        }

        const targetUrl = `${BUSES_API}/lectura_tarjeta`;
        const fetchUrl = PROXY_BASE
            ? `${PROXY_BASE}?url=${encodeURIComponent(targetUrl)}`
            : targetUrl;

        const response = await fetch(fetchUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json; charset=UTF-8',
                'Host': 'tmsa-transmiapp-shvpc.uc.r.appspot.com',
                'Appid': '9a2c3b48f0c24ae9bfba38e94f27c3ea',
                'User-Agent': 'okhttp/4.12.0',
                'uuid': '951d0eaf-daaf-464f-8baf-1d00fe09a01b',
                'version': '2.7.6',
            },
            body: JSON.stringify({ numero_tarjeta, consultar: 'true' }),
        });

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('Error reading card:', error);
        return NextResponse.json({ error: 'Failed to read card' }, { status: 500 });
    }
}
