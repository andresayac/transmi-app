import { describe, expect, it } from 'vitest';
import type { AlertTrip } from '@/lib/tripAlerts';
import { applyReport, initialState, PHONE_STALE_MS, step, type WatchState } from './step';

// Stops ~500 m apart going north
const stop = (i: number, lat0 = 4.6): [number, number] => [lat0 + i * 0.0045, -74.08];

const trip: AlertTrip = {
    dest: 'Unicentro',
    legs: [
        { m: 'W', to: 'Calle 45', d: 3 },
        { m: 'T', c: 'B13', n: 'Portal Norte', to: 'Calle 72', s: [0, 1, 2, 3, 4].map((i) => stop(i)), d: 10 },
        { m: 'W', to: 'Calle 72 - Av. Caracas', d: 2 },
        { m: 'T', c: 'K86', n: 'Usaquén', to: 'Unicentro', s: [0, 1, 2].map((i) => stop(i, 4.7)), d: 6 },
        { m: 'W', to: 'Unicentro', d: 4 },
    ],
};

const T0 = 1_800_000_000_000;
const at = (lat: number) => ({ lat, lng: -74.08 });

/** Rider on the B13 (leg 1), bus recognized, TransMi in the background. */
function riding(extra: Partial<WatchState> = {}): WatchState {
    return { ...initialState(trip, 1, 'B13-1001', 2, T0), visible: false, ...extra };
}

describe('trip alerts: following the bus', () => {
    it('warns two stops before, once', () => {
        const first = step(trip, riding(), at(4.6 + 2.5 * 0.0045), T0 + 60000);
        expect(first.push).toEqual([{ title: 'Prepárate para bajarte', body: 'Te bajas en 2 paradas: Calle 72', tag: 'trip-alarm-1' }]);
        const again = step(trip, first.state, at(4.6 + 2.7 * 0.0045), T0 + 72000);
        expect(again.push).toEqual([]);
    });

    it('says "get off" near the stop, with what comes next, and moves on to the next leg', () => {
        const { push, state } = step(trip, riding({ progress: 3.2 }), at(4.6 + 3.6 * 0.0045), T0 + 60000);
        expect(push).toHaveLength(1);
        expect(push[0]).toMatchObject({ title: 'Bájate aquí', tag: 'trip-alight-1' });
        expect(push[0].body).toBe('Calle 72. Luego toma el K86 hacia Usaquén en Calle 72 - Av. Caracas. Abre TransMi al subir y te aviso dónde bajarte.');
        expect(state).toMatchObject({ leg: 2, bus: null, progress: 0, legSince: T0 + 60000, done: false });
    });

    it('stays quiet while TransMi is on screen (the phone alerts by itself), but still follows the trip', () => {
        const near = at(4.6 + 3.6 * 0.0045);
        const onScreen = step(trip, riding({ visible: true, seenAt: T0 + 50000, progress: 3.2 }), near, T0 + 60000);
        expect(onScreen.push).toEqual([]);
        expect(onScreen.state.leg).toBe(2);
    });

    it('takes over when the phone stops reporting, even if it last said it was on screen', () => {
        const frozen = riding({ visible: true, seenAt: T0 });
        const { push } = step(trip, frozen, at(4.6 + 2.5 * 0.0045), T0 + PHONE_STALE_MS + 1000);
        expect(push.map((p) => p.tag)).toEqual(['trip-alarm-1']);
    });

    it("doesn't repeat what the phone already said", () => {
        const { push } = step(trip, riding({ fired: ['alarm:1'] }), at(4.6 + 2.5 * 0.0045), T0 + 60000);
        expect(push).toEqual([]);
    });

    it('ignores readings far from the ride and never goes backwards', () => {
        const off = step(trip, riding({ progress: 1 }), { lat: 4.6 + 3 * 0.0045, lng: -74.1 }, T0 + 60000);
        expect(off.push).toEqual([]);
        expect(off.state.progress).toBe(1);
        const back = step(trip, riding({ progress: 2.5 }), at(4.6 + 0.5 * 0.0045), T0 + 60000);
        expect(back.state.progress).toBe(2.5);
    });

    it('ends after the last ride with the walk that is left', () => {
        const lastRide = { ...initialState(trip, 3, 'K86-77', 2, T0), visible: false, progress: 1.5 };
        const { push, state } = step(trip, lastRide, at(4.7 + 1.8 * 0.0045), T0 + 60000);
        expect(push[0].body).toBe('Unicentro. Luego camina 4 min hasta Unicentro.');
        expect(state.done).toBe(true);
        expect(step(trip, state, at(4.7), T0 + 120000).push).toEqual([]);
    });
});

describe('trip alerts: without the bus', () => {
    it('walks forward by the timetable while the phone is away', () => {
        const walking = { ...initialState(trip, 0, null, 2, T0), visible: false };
        expect(step(trip, walking, undefined, T0 + 2 * 60000).state.leg).toBe(0);
        expect(step(trip, walking, undefined, T0 + 3 * 60000).state).toMatchObject({ leg: 1, legSince: T0 + 3 * 60000 });
    });

    it('sends one reminder from the timetable when the bus is unknown', () => {
        const waiting = { ...initialState(trip, 1, null, 2, T0), visible: false };
        // 4 min wait + 10 min ride − 5 min lead (2 stops × 2.5 min)
        expect(step(trip, waiting, undefined, T0 + 8 * 60000).push).toEqual([]);
        const due = step(trip, waiting, undefined, T0 + 9 * 60000);
        expect(due.push).toEqual([{
            title: 'Revisa tu parada',
            body: 'Por el tiempo, ya deberías ir llegando a Calle 72, donde te bajas. Abre TransMi para avisarte justo a tiempo.',
            tag: 'trip-hint-1',
        }]);
        expect(step(trip, due.state, undefined, T0 + 10 * 60000).push).toEqual([]);
    });

    it('falls back to the timetable when the bus vanishes from the feed', () => {
        let s = riding();
        for (let i = 0; i < 20; i++) s = step(trip, s, null, T0 + 60000).state;
        expect(step(trip, s, null, T0 + 13 * 60000).push.map((p) => p.tag)).toEqual(['trip-hint-1']);
    });
});

describe('trip alerts: reports from the phone', () => {
    const report = { key: 'k'.repeat(32), visible: false, fired: [], alarmStops: 2 };

    it('moves forward with the phone and takes the bus it recognized', () => {
        const s = applyReport(trip, initialState(trip, 0, null, 2, T0), { ...report, leg: 1, bus: 'B13-1001' }, T0 + 5000);
        expect(s).toMatchObject({ leg: 1, bus: 'B13-1001', legSince: T0 + 5000, visible: false, seenAt: T0 + 5000 });
    });

    it('keeps its own leg when the phone is behind (it just woke up)', () => {
        const ahead = { ...riding(), leg: 2, bus: null };
        const s = applyReport(trip, ahead, { ...report, leg: 1, bus: 'B13-1001', fired: ['alarm:1'] }, T0 + 5000);
        expect(s).toMatchObject({ leg: 2, bus: null });
        expect(s.fired).toContain('alarm:1');
    });
});
