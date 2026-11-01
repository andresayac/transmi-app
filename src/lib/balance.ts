/**
 * What's probably left on the TuLlave card. The balance is only known when the
 * rider checks it, but trips finished in the app since then each cost at least
 * one fare, so subtract those. It's an estimate (transfers and recharges made
 * meanwhile aren't known), shown as such and never below zero.
 */

export interface BalanceReading {
    value: number;
    at: string;
}

export interface BalanceEstimate {
    /** Last balance read from the card */
    checked: number;
    /** After the trips logged since that reading */
    value: number;
    tripsSince: number;
}

export function estimateBalance(
    reading: BalanceReading | null,
    trips: { startedAt: string; lines: string[] }[],
    fare: number,
): BalanceEstimate | null {
    if (!reading) return null;
    const since = Date.parse(reading.at);
    const tripsSince = Number.isNaN(since) ? 0 : trips.filter((t) => t.lines.length > 0 && Date.parse(t.startedAt) > since).length;
    return { checked: reading.value, value: Math.max(0, reading.value - tripsSince * fare), tripsSince };
}

/** Whole trips a balance pays for. */
export function tripsLeft(balance: number, fare: number): number {
    return fare > 0 ? Math.max(0, Math.floor(balance / fare)) : 0;
}

/** "TIENDA INCIENSOS RAMAYANA" → "Tienda Inciensos Ramayana" (short words stay lower case). */
export function titleCase(text: string): string {
    const small = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'e', 'el', 'en']);
    return text
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean)
        .map((w, i) => (i > 0 && small.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
        .join(' ');
}
