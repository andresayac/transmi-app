/**
 * Do two route destinations name the same direction? Feeds abbreviate and vary
 * ("P. Norte" vs "Portal Norte", "P.USME" vs "Portal Usme"), so compare loosely:
 * accents, case and punctuation ignored, and either name may contain the other.
 */
export function sameDirection(a: string, b: string): boolean {
    const norm = (s: string) => s
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        // "P. Norte" / "P.USME" / "P Norte" → "portal …", but leave "Portal" itself alone
        .replace(/^p(\.\s*|\s+)(?=[a-z])/, 'portal ')
        .replace(/[^a-z0-9 ]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    const x = norm(a), y = norm(b);
    return !!x && !!y && (x.includes(y) || y.includes(x));
}

/** Pick the soonest arrival of a route, preferring the requested direction when the feed has it. */
export function nextArrivalFor<T extends { code: string; destination: string; minutes: number | null }>(arrivals: T[], code: string, direction: string): T | null {
    const sameRoute = arrivals.filter((a) => a.code.toUpperCase() === code.toUpperCase() && a.minutes !== null);
    const matching = sameRoute.filter((a) => sameDirection(a.destination, direction));
    return [...(matching.length ? matching : sameRoute)].sort((a, b) => a.minutes! - b.minutes!)[0] || null;
}
