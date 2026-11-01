import type { Itinerary, ItineraryTag, PlanLeg, PlanPlace } from '@/types/transit';

/**
 * TransMilenio stop names pack the platform into the name: "Flores B - 4 ó 6-T"
 * is station Flores, vagón B, doors 4 or 6. Split them so the station reads first.
 */
export function stopLabel(raw: string): { station: string; platform: string | null } {
    const name = (raw || '').trim();
    const match = name.match(/^(.+?)\s+([A-Z]\d?[A-Z]?)\s+-\s+([\d\sóoy,]+?)(?:-\w+)?$/);
    if (!match) return { station: name.replace(/-T$/, ''), platform: null };
    const doors = match[3].trim();
    return { station: match[1].trim(), platform: `Vagón ${match[2]} · puerta ${doors}` };
}

export const TAG_LABELS: Record<ItineraryTag, string> = {
    'fastest': 'Más rápida',
    'fewest-transfers': 'Menos transbordos',
    'least-walking': 'Menos caminata',
};

/** OTP's own transfer counter counts boardings; derive it from the legs instead. */
export function transferCount(it: Itinerary): number {
    return Math.max(0, it.legs.filter((l) => l.mode === 'TRANSIT').length - 1);
}

export function transferText(n: number): string {
    if (n === 0) return 'Directo';
    return n === 1 ? '1 transbordo' : `${n} transbordos`;
}

export function transitLegs(it: Itinerary): PlanLeg[] {
    return it.legs.filter((l) => l.mode === 'TRANSIT');
}

export interface Departure {
    mode: 'now' | 'at';
    /** yyyy-MM-dd, Bogotá wall date */
    date: string;
    /** HH:mm, Bogotá wall time */
    time: string;
}

/** Wall-clock Date (getHours() = Bogotá hour) for a scheduled departure. */
export function departureDate(dep: Departure, now: Date): Date {
    if (dep.mode === 'now' || !dep.date || !dep.time) return now;
    const [y, m, d] = dep.date.split('-').map(Number);
    const [hh, mm] = dep.time.split(':').map(Number);
    return new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0);
}

export function ymd(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function hm(date: Date): string {
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** Query string for /planear deep links and /api/plan. */
export function placeParams(prefix: 'from' | 'to', place: PlanPlace): Record<string, string> {
    return {
        [`${prefix}Lat`]: place.lat.toFixed(6),
        [`${prefix}Lng`]: place.lng.toFixed(6),
        [`${prefix}Name`]: place.name,
    };
}

export function placeFromParams(q: URLSearchParams, prefix: 'from' | 'to'): PlanPlace | null {
    const lat = parseFloat(q.get(`${prefix}Lat`) || '');
    const lng = parseFloat(q.get(`${prefix}Lng`) || '');
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { name: q.get(`${prefix}Name`) || (prefix === 'from' ? 'Origen' : 'Destino'), lat, lng, kind: 'place' };
}

export function samePlace(a: PlanPlace | null, b: PlanPlace | null): boolean {
    if (!a || !b) return a === b;
    return Math.abs(a.lat - b.lat) < 0.00001 && Math.abs(a.lng - b.lng) < 0.00001;
}

export function plannerUrl(from: PlanPlace | null, to: PlanPlace | null, extra: Record<string, string> = {}): string {
    const params = new URLSearchParams({
        ...(to ? placeParams('to', to) : {}),
        ...(from && from.kind !== 'gps' ? placeParams('from', from) : {}),
        ...extra,
    });
    const qs = params.toString();
    return qs ? `/planear?${qs}` : '/planear';
}
