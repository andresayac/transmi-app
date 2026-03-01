import { NextResponse } from 'next/server';

const BUSES_API = 'https://tmsa-transmiapp-shvpc.uc.r.appspot.com';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { estacion, ruta, idRuta, Nombre, Distancia = '100' } = body;

        const response = await fetch(`${BUSES_API}/getServicios`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json; charset=UTF-8',
                'Appid': '9a2c3b48f0c24ae9bfba38e94f27c3ea',
                'User-Agent': 'okhttp/4.12.0',
                'uuid': '951d0eaf-daaf-464f-8baf-1d00fe09a01b',
                'version': '2.7.6',
            },
            body: JSON.stringify({ estacion, ruta, idRuta, Nombre, Distancia }),
        });

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('Error fetching servicios:', error);
        return NextResponse.json({ error: 'Failed to fetch ETA' }, { status: 500 });
    }
}
