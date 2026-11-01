import { describe, expect, it } from 'vitest';
import { leaveInMinutes, suggestRoutine, type RoutineTrip } from './routine';
import type { PlanPlace } from '@/types/transit';

const home: PlanPlace = { name: 'Casa', lat: 4.6486, lng: -74.0628 };
const work: PlanPlace = { name: 'Trabajo', lat: 4.6930, lng: -74.0560 };
const gym: PlanPlace = { name: 'Gimnasio', lat: 4.7100, lng: -74.0700 };

// Local-time dates: the routine works in the phone's clock
const at = (y: number, mo: number, d: number, h: number, mi = 0) => new Date(y, mo - 1, d, h, mi);
const tuesday8am = at(2026, 10, 27, 8);
const tuesday6pm = at(2026, 10, 27, 18);
const saturday10am = at(2026, 10, 31, 10);

const trip = (date: Date, to: PlanPlace): RoutineTrip => ({ startedAt: date.toISOString(), toPlace: to });

describe('suggestRoutine', () => {
    it('suggests work on weekday mornings and home in the evening', () => {
        expect(suggestRoutine({ now: tuesday8am, home, work, trips: [] })).toMatchObject({ title: 'Hacia el trabajo', reason: 'work' });
        expect(suggestRoutine({ now: tuesday6pm, home, work, trips: [] })).toMatchObject({ title: 'Hacia casa', reason: 'home' });
    });

    it('stays quiet on weekends without a learned habit', () => {
        expect(suggestRoutine({ now: saturday10am, home, work, trips: [] })).toBeNull();
    });

    it('learns a destination repeated at the same time on the same kind of day', () => {
        const trips = [trip(at(2026, 10, 24, 9, 50), gym), trip(at(2026, 10, 17, 10, 20), gym)];
        expect(suggestRoutine({ now: saturday10am, home, work, trips })).toMatchObject({ title: 'Hacia Gimnasio', reason: 'learned' });
    });

    it('needs at least two trips to call it a habit', () => {
        const trips = [trip(at(2026, 10, 24, 10), gym)];
        expect(suggestRoutine({ now: saturday10am, home, work, trips })).toBeNull();
    });

    it('ignores trips at a very different time of day', () => {
        const trips = [trip(at(2026, 10, 24, 19), gym), trip(at(2026, 10, 17, 20), gym)];
        expect(suggestRoutine({ now: saturday10am, home, work, trips })).toBeNull();
    });

    it('suggests nothing when the rider is already there', () => {
        expect(suggestRoutine({ now: tuesday8am, home, work, trips: [], here: { lat: work.lat + 0.001, lng: work.lng } })).toBeNull();
    });

    it('prefers a learned habit over the default commute', () => {
        const trips = [trip(at(2026, 10, 20, 8), gym), trip(at(2026, 10, 13, 8, 10), gym)];
        expect(suggestRoutine({ now: tuesday8am, home, work, trips })?.place.name).toBe('Gimnasio');
    });
});

describe('leaveInMinutes', () => {
    it('subtracts the walk and a one-minute margin from the bus arrival', () => {
        expect(leaveInMinutes(12, 5)).toBe(6);
        expect(leaveInMinutes(4, 5)).toBe(-2);
    });
});
