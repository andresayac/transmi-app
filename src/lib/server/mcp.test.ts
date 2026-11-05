import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createMcpServer } from './mcp';
import { createTools } from './assistant/tools';
import type { Itinerary } from '@/types/transit';

vi.mock('@/lib/server/transit', () => ({
    planTrip: vi.fn(async () => [{ durationMin: 42, walkMeters: 300, transfers: 1, tags: [], legs: [] } as unknown as Itinerary]),
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
});
