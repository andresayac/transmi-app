import { describe, expect, it } from 'vitest';
import { cn } from './utils';

describe('cn', () => {
    it('keeps the app font sizes next to text colors', () => {
        expect(cn('text-11 transition-colors', 'text-muted-foreground')).toBe('text-11 transition-colors text-muted-foreground');
    });

    it('still lets a later font size win', () => {
        expect(cn('text-13', 'text-15')).toBe('text-15');
        expect(cn('text-sm', 'text-15')).toBe('text-15');
    });
});
