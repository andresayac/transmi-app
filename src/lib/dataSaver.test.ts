import { describe, expect, it } from 'vitest';
import { saverInterval } from './dataSaver';

describe('saverInterval', () => {
    it('leaves polling alone when not saving', () => {
        expect(saverInterval(30000, false)).toBe(30000);
    });

    it('polls half as often, never faster than every 20 s', () => {
        expect(saverInterval(30000, true)).toBe(60000);
        expect(saverInterval(8000, true)).toBe(20000);
    });

    it('keeps one-shot fetches one-shot', () => {
        expect(saverInterval(0, true)).toBe(0);
    });
});
