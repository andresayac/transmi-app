import { describe, expect, it } from 'vitest';
import { estimateBalance, titleCase, tripsLeft } from './balance';
import { colombianHolidays, isHoliday, openingState, serviceDay } from './schedule';

describe('estimateBalance', () => {
    const reading = { value: 10000, at: '2026-10-28T12:00:00Z' };

    it('subtracts a fare for each transit trip logged after the reading', () => {
        const trips = [
            { startedAt: '2026-10-29T12:00:00Z', lines: ['B13'] },
            { startedAt: '2026-10-30T12:00:00Z', lines: ['8', 'B75'] },
            { startedAt: '2026-10-27T12:00:00Z', lines: ['C15'] }, // before the reading
            { startedAt: '2026-10-29T18:00:00Z', lines: [] }, // walk only
        ];
        expect(estimateBalance(reading, trips, 3550)).toEqual({ checked: 10000, value: 2900, tripsSince: 2 });
    });

    it('never goes below zero and needs a reading', () => {
        const trips = Array.from({ length: 5 }, (_, i) => ({ startedAt: `2026-10-29T1${i}:00:00Z`, lines: ['B13'] }));
        expect(estimateBalance(reading, trips, 3550)?.value).toBe(0);
        expect(estimateBalance(null, trips, 3550)).toBeNull();
    });

    it('counts whole trips', () => {
        expect(tripsLeft(7100, 3550)).toBe(2);
        expect(tripsLeft(7099, 3550)).toBe(1);
    });
});

describe('titleCase', () => {
    it('makes shouting store names readable', () => {
        expect(titleCase('TIENDA DE LA ESQUINA  EL SOL')).toBe('Tienda de la Esquina el Sol');
    });
});

describe('festivos', () => {
    it('knows the 2026 holidays, including the ones moved to Monday', () => {
        const days = colombianHolidays(2026);
        expect(days.size).toBe(18);
        for (const d of ['2026-01-12', '2026-03-23', '2026-04-02', '2026-04-03', '2026-05-18', '2026-06-08', '2026-06-15', '2026-08-17', '2026-11-02', '2026-11-16']) {
            expect(days.has(d)).toBe(true);
        }
        expect(days.has('2026-01-06')).toBe(false); // Reyes moved to Monday the 12th
    });

    it('runs Sunday service on a holiday', () => {
        const holidayMonday = new Date(2026, 10, 2, 8);
        expect(isHoliday(holidayMonday)).toBe(true);
        expect(serviceDay(holidayMonday)).toBe(0);
        expect(serviceDay(new Date(2026, 10, 3, 8))).toBe(2);
    });
});

describe('openingState', () => {
    const hours = { wk: '08:00-21:00', sat: '09:00-13:00', hol: 'Sin Servicio' };

    it('reads the hours for the kind of day', () => {
        expect(openingState(hours, new Date(2026, 9, 28, 20, 30))).toEqual({ open: true, closesAt: 21 * 60 });
        expect(openingState(hours, new Date(2026, 9, 31, 14))).toEqual({ open: false, closesAt: null }); // Saturday afternoon
        expect(openingState(hours, new Date(2026, 10, 2, 10)).open).toBe(false); // festivo
    });

    it('handles places that close after midnight', () => {
        const late = { wk: '18:00-02:00', sat: '18:00-02:00', hol: '18:00-02:00' };
        expect(openingState(late, new Date(2026, 9, 28, 23))).toEqual({ open: true, closesAt: 26 * 60 });
        expect(openingState(late, new Date(2026, 9, 28, 1))).toEqual({ open: true, closesAt: 2 * 60 });
        expect(openingState(late, new Date(2026, 9, 28, 3)).open).toBe(false);
    });
});
