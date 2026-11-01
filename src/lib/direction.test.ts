import { describe, expect, it } from 'vitest';
import { nextArrivalFor, sameDirection } from './direction';

describe('sameDirection', () => {
    it('ignores accents, case and abbreviations', () => {
        expect(sameDirection('P. Norte', 'Portal Norte')).toBe(true);
        expect(sameDirection('P.USME', 'Portal Usme')).toBe(true);
        expect(sameDirection('Alcalá', 'alcala')).toBe(true);
    });

    it('tells opposite directions apart', () => {
        expect(sameDirection('Terminal', 'Guatoque')).toBe(false);
        expect(sameDirection('Portal Norte', 'Portal Sur')).toBe(false);
    });

    it('never matches empty names', () => {
        expect(sameDirection('', 'Terminal')).toBe(false);
    });
});

describe('nextArrivalFor', () => {
    const board = [
        { code: '8', destination: 'Guatoque', minutes: 0 },
        { code: '8', destination: 'Terminal', minutes: 5 },
        { code: 'B13', destination: 'Portal Norte', minutes: 3 },
        { code: '8', destination: 'Terminal', minutes: null },
    ];

    it('picks the requested direction even when the other one arrives first', () => {
        expect(nextArrivalFor(board, '8', 'Terminal')).toMatchObject({ destination: 'Terminal', minutes: 5 });
    });

    it('falls back to the route when no destination matches', () => {
        expect(nextArrivalFor(board, '8', 'Calle 72')).toMatchObject({ destination: 'Guatoque', minutes: 0 });
    });

    it('returns null when the route is not on the board', () => {
        expect(nextArrivalFor(board, 'K23', 'Portal Eldorado')).toBeNull();
    });
});
