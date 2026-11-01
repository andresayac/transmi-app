/** Official troncal colors by letter, as published by the TransMilenio API. */
export const TRONCAL_COLORS: Record<string, string> = {
    A: '#26358C',
    B: '#80BA27',
    C: '#FCBD1B',
    D: '#8064A9',
    E: '#AE6B00',
    F: '#DC0814',
    G: '#009CDE',
    H: '#F18500',
    J: '#E1A2AC',
    K: '#D5B079',
    L: '#009A9D',
    M: '#009A9D',
    P: '#A80F79',
    T: '#808000',
    Z: '#BD202A',
};

export const ZONAL_BLUE = '#00618E';

function hexToRgb(hex: string): [number, number, number] | null {
    const clean = hex?.replace('#', '').trim();
    if (!clean || !/^[0-9a-f]{3}([0-9a-f]{3})?$/i.test(clean)) return null;
    const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
    const n = parseInt(full, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luminance([r, g, b]: [number, number, number]): number {
    const f = (c: number) => {
        const s = c / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

/** Pick black or white text for a given background color. */
export function readableOn(hex: string): '#000000' | '#ffffff' {
    const rgb = hexToRgb(hex);
    if (!rgb) return '#ffffff';
    return luminance(rgb) > 0.42 ? '#000000' : '#ffffff';
}

/** Normalize API colors: empty, missing or pure black routes fall back to a neutral. */
export function routeColor(color?: string | null, fallback = '#525252'): string {
    const rgb = color ? hexToRgb(color) : null;
    if (!rgb) return fallback;
    return color!.startsWith('#') ? color! : `#${color}`;
}

/** Hex color with alpha (0–1). */
export function withAlpha(hex: string, alpha: number): string {
    const rgb = hexToRgb(hex);
    if (!rgb) return hex;
    return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
}

/**
 * Infer the troncal color from a route code like "B23" or "K10" when the API
 * doesn't give one. Zonal routes (numeric or with dashes) get the SITP blue.
 */
export function colorForRouteCode(code: string, apiColor?: string | null): string {
    if (apiColor && hexToRgb(apiColor) && apiColor.toLowerCase() !== '#000000') return routeColor(apiColor);
    const letter = code?.trim().charAt(0).toUpperCase();
    if (letter && TRONCAL_COLORS[letter] && /^[A-Z]\d/i.test(code.trim())) return TRONCAL_COLORS[letter];
    return apiColor && hexToRgb(apiColor) ? routeColor(apiColor) : ZONAL_BLUE;
}
