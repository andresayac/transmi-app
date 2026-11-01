import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createSharedTrip, getSharedTrip, parseTrip, SHARE_ID, updateSharedTrip } from './sharedTrips';
import type { SharedTrip } from '@/lib/tripShare';

const dataDir = mkdtempSync(path.join(tmpdir(), 'transmi-sigue-'));

beforeAll(() => {
    process.env.DATA_DIR = dataDir;
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-03T13:00:00Z'));
});

afterAll(() => {
    vi.useRealTimers();
    rmSync(dataDir, { recursive: true, force: true });
});

const trip: SharedTrip = {
    v: 1,
    by: 'Andrés',
    to: ['Unicentro', 4.7024, -74.0412],
    at: 1793710800,
    eta: 1793713000,
    sh: 1793710900,
    cur: 1,
    bus: 'T06-1234',
    legs: [
        { m: 'W', f: ['Casa', 4.6486, -74.0628], t: ['U Pedagógica', 4.6544, -74.0611], d: 2, g: '_p~iF~ps|U' },
        { m: 'T', c: 'T06', n: 'San Luis', k: '#00618E', f: ['U Pedagógica', 4.6544, -74.0611], t: ['Embajada del Perú', 4.67, -74.05], d: 15, g: '_p~iF~ps|U' },
        { m: 'T', c: 'B303', n: 'Unicentro', k: '#00618E', f: ['Embajada del Perú', 4.67, -74.05], t: ['Br. Santa Bárbara', 4.70, -74.04], d: 14, g: '_p~iF~ps|U' },
        { m: 'W', f: ['Br. Santa Bárbara', 4.70, -74.04], t: ['Unicentro', 4.7024, -74.0412], d: 5, g: '_p~iF~ps|U' },
    ],
};

const later = (seconds: number) => vi.setSystemTime(new Date(Date.now() + seconds * 1000));

describe('shared trips', () => {
    let id = '';
    let key = '';

    it('stores a trip under a short id and starts from what the link knew', async () => {
        ({ id, key } = await createSharedTrip(trip));
        expect(id).toMatch(SHARE_ID);
        const shared = await getSharedTrip(id);
        expect(shared?.trip.to[0]).toBe('Unicentro');
        expect(shared?.state).toMatchObject({ leg: 1, bus: 'T06-1234', ended: false });
    });

    it('only accepts reports from the phone that created the link', async () => {
        expect(await updateSharedTrip(id, { key: 'x'.repeat(32), leg: 2, bus: null, eta: null })).toBe('forbidden');
        expect(await updateSharedTrip('nope-nope1', { key, leg: 2, bus: null, eta: null })).toBe('not_found');
    });

    it('follows a transfer: new leg and new bus, with the time it changed', async () => {
        later(600);
        const changedAt = Date.now();
        expect(await updateSharedTrip(id, { key, leg: 2, bus: 'B303-77', eta: changedAt + 20 * 60000 })).toBe('ok');
        later(60);
        expect(await updateSharedTrip(id, { key, leg: 2, bus: 'B303-77', eta: changedAt + 19 * 60000 })).toBe('ok');
        const { state } = (await getSharedTrip(id))!;
        expect(state).toMatchObject({ leg: 2, bus: 'B303-77', since: changedAt, at: changedAt + 60000 });
    });

    it('throttles repeated heartbeats but never a change', async () => {
        const eta = (await getSharedTrip(id))!.state.eta;
        expect(await updateSharedTrip(id, { key, leg: 2, bus: 'B303-77', eta })).toBe('too_soon');
        expect(await updateSharedTrip(id, { key, leg: 3, bus: null, eta })).toBe('ok');
    });

    it('survives a restart: the trip is read back from its file', async () => {
        (globalThis as { __sharedTrips?: Map<string, unknown> }).__sharedTrips?.clear();
        const shared = await getSharedTrip(id);
        expect(shared?.state).toMatchObject({ leg: 3, bus: null });
    });

    it('closes once the trip ended', async () => {
        later(30);
        expect(await updateSharedTrip(id, { key, leg: 3, bus: null, eta: null, ended: true })).toBe('ok');
        expect((await getSharedTrip(id))!.state.ended).toBe(true);
        expect(await updateSharedTrip(id, { key, leg: 3, bus: null, eta: null })).toBe('closed');
    });

    it('rejects malformed trips', () => {
        expect(parseTrip(trip)).not.toBeNull();
        expect(parseTrip({ ...trip, legs: [] })).toBeNull();
        expect(parseTrip({ ...trip, legs: [{ ...trip.legs[1], k: 'red;background:url(x)' }] })).toBeNull();
        expect(parseTrip({ ...trip, v: 2 })).toBeNull();
    });
});
