import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createSchema, createWatch, updateWatch } from './store';

const dataDir = mkdtempSync(path.join(tmpdir(), 'transmi-avisos-'));

beforeAll(() => {
    process.env.DATA_DIR = dataDir;
});

afterAll(() => {
    rmSync(dataDir, { recursive: true, force: true });
});

const input = {
    subscription: { endpoint: 'https://fcm.googleapis.com/fcm/send/abc123', keys: { p256dh: 'BPx', auth: 'xyz' } },
    trip: { dest: 'Unicentro', legs: [{ m: 'T', c: 'B13', to: 'Calle 72', s: [[4.6, -74.08], [4.61, -74.08]], d: 10 }] },
    leg: 0,
    bus: null,
    alarmStops: 2,
};

const report = (key: string, extra = {}) => ({ key, leg: 0, bus: 'B13-1001', visible: false, fired: ['alarm:0'], alarmStops: 2, ...extra });

describe('trip alerts store', () => {
    it('only talks to the browsers\' push services', () => {
        expect(createSchema.safeParse(input).success).toBe(true);
        for (const endpoint of ['https://evil.example.com/push', 'http://fcm.googleapis.com/x', 'https://fcm.googleapis.com.evil.com/x']) {
            expect(createSchema.safeParse({ ...input, subscription: { ...input.subscription, endpoint } }).success).toBe(false);
        }
        expect(createSchema.safeParse({ ...input, subscription: { ...input.subscription, endpoint: 'https://web.push.apple.com/QGx' } }).success).toBe(true);
    });

    it('registers a trip, takes reports only with its key, and forgets it when it ends', async () => {
        const created = await createWatch(createSchema.parse(input), 'https://transmi.example.co');
        if (created === 'full') throw new Error('full');
        const { id, key } = created;
        expect(existsSync(path.join(dataDir, 'avisos', `${id}.json`))).toBe(true);

        expect(await updateWatch(id, report('x'.repeat(32)))).toEqual({ result: 'forbidden' });
        expect(await updateWatch(id, report(key))).toEqual({ result: 'ok', fired: ['alarm:0'] });
        expect(await updateWatch(id, report(key, { ended: true }))).toEqual({ result: 'ended' });
        expect(existsSync(path.join(dataDir, 'avisos', `${id}.json`))).toBe(false);
        expect(await updateWatch(id, report(key))).toEqual({ result: 'not_found' });
    });

    it('keeps one trip per phone', async () => {
        const first = await createWatch(createSchema.parse(input), undefined);
        const second = await createWatch(createSchema.parse(input), undefined);
        if (first === 'full' || second === 'full') throw new Error('full');
        expect(await updateWatch(first.id, report(first.key))).toEqual({ result: 'not_found' });
        expect((await updateWatch(second.id, report(second.key))).result).toBe('ok');
    });
});
