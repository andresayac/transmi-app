import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createMcpServer } from './mcp';
import { createTools } from './assistant/tools';
import type { Itinerary } from '@/types/transit';

const CARD = '1234567890123456';

vi.mock('@/lib/server/transit', () => ({
    planTrip: vi.fn(async () => [{ durationMin: 42, walkMeters: 300, transfers: 1, tags: [], legs: [] } as unknown as Itinerary]),
    getFare: vi.fn(async () => 3550),
    getCardBalance: vi.fn(async (n: string) => (n === '1234567890123456' ? { value: 5000, kind: 'Básica', lastTransaction: '2026-11-05 13:30:00 UTC' } : null)),
    nearestServicePoints: vi.fn(async () => [
        { name: 'Droguería de la tarde', address: 'Cl 72 # 10-20', lat: 4.658, lng: -74.063, locality: '', hours: { wk: '14:00-18:00', sat: '', hol: '' }, distanceM: 120 },
        { name: 'Tienda del día', address: 'Cr 11 # 72-30', lat: 4.659, lng: -74.062, locality: '', hours: { wk: '08:00-21:00', sat: '', hol: '' }, distanceM: 300 },
    ]),
}));

vi.mock('@/lib/server/sharedTrips', () => ({
    SHARE_ID: /^[A-Za-z0-9_-]{10}$/,
    getSharedTrip: vi.fn(async (id: string) => (id !== 'Xk3a9Qz2Lp' ? null : {
        trip: {
            v: 1,
            by: 'Andrés',
            to: ['Unicentro', 4.7024, -74.0412],
            at: 1793710800,
            eta: 1793713000,
            sh: 1793710900,
            cur: 0,
            legs: [
                { m: 'W', f: ['Casa', 4.61, -74.08], t: ['Calle 72', 4.658, -74.063], d: 5, g: '' },
                { m: 'T', c: 'B13', n: 'Portal Norte', k: '#000', f: ['Calle 72', 4.658, -74.063], t: ['Calle 100', 4.686, -74.056], d: 12, g: '' },
                { m: 'T', c: '192', n: 'Unicentro', k: '#000', f: ['Calle 100', 4.686, -74.056], t: ['Unicentro', 4.7024, -74.0412], d: 8, g: '' },
            ],
        },
        state: { leg: 1, bus: 'A10072', eta: Date.parse('2026-11-05T15:25:00Z'), since: Date.now() - 300000, at: Date.now() - 120000, ended: false },
    })),
}));

beforeAll(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-05T15:00:00Z')); // 10:00 in Bogotá
});

afterAll(() => {
    vi.useRealTimers();
});

async function connect(): Promise<Client> {
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    await createMcpServer('https://transmi.example').connect(serverSide);
    const client = new Client({ name: 'test', version: '1.0.0' });
    await client.connect(clientSide);
    return client;
}

const trip = {
    origen: { nombre: 'Casa', lat: 4.6097, lng: -74.0817 },
    destino: { nombre: 'Unicentro', lat: 4.7024, lng: -74.0412 },
};

describe('MCP server', () => {
    it('offers the assistant tools, read-only', async () => {
        const { tools } = await (await connect()).listTools();
        expect(tools.map((t) => t.name)).toEqual(createTools(() => { }, {}).map((t) => t.name));
        for (const tool of tools) {
            expect(tool.annotations?.readOnlyHint).toBe(true);
            expect(tool.inputSchema.type).toBe('object');
        }
        expect(tools.find((t) => t.name === 'planear_viaje')?.inputSchema.required).toEqual(['origen', 'destino']);
    });

    it('describes links instead of the app cards, and leaves the app descriptions alone', async () => {
        const { tools } = await (await connect()).listTools();
        const plan = tools.find((t) => t.name === 'planear_viaje')!;
        expect(plan.description).not.toContain('la app muestra');
        expect(plan.description).toContain('enlace');
        const app = createTools(() => { }, {}).find((t) => t.name === 'planear_viaje')!;
        expect(app.description).toMatch(/; la app muestra las tarjetas completas\.$/);
    });

    it('links a planned trip to the planner, leaving today at the asked time', async () => {
        const result = await (await connect()).callTool({ name: 'planear_viaje', arguments: { ...trip, hora_salida: '7:30' } });
        expect(result.isError).toBeFalsy();
        const body = JSON.parse((result.content as { type: string; text: string }[])[0].text);
        expect(body.opciones).toHaveLength(1);
        const link = new URL(body.abrir_en_transmi);
        expect(link.origin + link.pathname).toBe('https://transmi.example/planear');
        expect(Object.fromEntries(link.searchParams)).toMatchObject({
            fromName: 'Casa',
            toName: 'Unicentro',
            toLat: '4.702400',
            date: '2026-11-05',
            time: '07:30',
        });
    });

    it('rejects places outside Bogotá before calling the planner', async () => {
        const result = await (await connect()).callTool({
            name: 'planear_viaje',
            arguments: { ...trip, destino: { nombre: 'Madrid', lat: 40.4, lng: -3.7 } },
        });
        expect(result.isError).toBe(true);
    });

    it('reads a TuLlave balance as trips left, without echoing the card number', async () => {
        const text = textOf(await (await connect()).callTool({ name: 'consultar_saldo', arguments: { numero_tarjeta: CARD } }));
        expect(text).not.toContain(CARD);
        const body = JSON.parse(text);
        expect(body).toMatchObject({ saldo_cop: 5000, alcanza_para_viajes: 1, tarifa_cop: 3550 });
        expect(body.ultima_transaccion).toMatch(/^5\/11\/2026 8:30/); // 13:30 UTC is 8:30 in Bogotá
        expect(body.nota).toContain('puntos_recarga_cercanos');
    });

    it('asks to check the number when the card cannot be read', async () => {
        const text = textOf(await (await connect()).callTool({ name: 'consultar_saldo', arguments: { numero_tarjeta: '9999999999' } }));
        expect(text).toContain('revisar el número');
    });

    it('keeps only recharge points open right now, with their closing time', async () => {
        const text = textOf(await (await connect()).callTool({
            name: 'puntos_recarga_cercanos',
            arguments: { lat: 4.658, lng: -74.063, solo_abiertos: true },
        }));
        const points = JSON.parse(text);
        expect(points.map((p: { nombre: string }) => p.nombre)).toEqual(['Tienda del día']);
        expect(points[0].abierto_ahora).toBe(true);
        expect(points[0].cierra).toMatch(/^9:00/);
    });

    it('follows a shared trip from its full link', async () => {
        const body = JSON.parse(textOf(await (await connect()).callTool({
            name: 'seguir_viaje',
            arguments: { enlace: 'Mira mi viaje: https://transmi.example/sigue/Xk3a9Qz2Lp' },
        })));
        expect(body).toMatchObject({
            quien: 'Andrés',
            destino: 'Unicentro',
            llego: false,
            tramo_actual: 'En el B13 hacia Portal Norte, de Calle 72 a Calle 100',
            bus: 'A10072',
            despues: 'Toma el 192 en Calle 100',
            ver_en_vivo: 'https://transmi.example/sigue/Xk3a9Qz2Lp',
        });
        expect(body.llegada_estimada).toMatch(/^10:25/);
        expect(body.nota).toBeUndefined();
    });
});

function textOf(result: Awaited<ReturnType<Client['callTool']>>): string {
    return (result.content as { type: string; text: string }[])[0].text;
}
