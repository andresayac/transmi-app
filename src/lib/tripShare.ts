import type { LngLat } from '@/lib/geo';
import { haversine, simplify } from '@/lib/geo';
import type { ActiveTrip } from '@/stores/app';
import type { Itinerary, PlanLeg, PlanPlace } from '@/types/transit';

/**
 * "Sigue mi viaje": whoever opens the link follows the *bus* the sender is on,
 * using TransMilenio's live bus positions, never the sender's phone location.
 *
 * The trip is stored by TransMi under a short id (/sigue/Xk3a9Qz2Lp), and while
 * the trip is open the sender's phone reports which leg it is on and which bus
 * it took (ShareState), so transfers are followed too. If the short link can't
 * be created, the whole trip travels in the URL fragment instead (/sigue#…).
 */

type Point = [name: string, lat: number, lng: number];

interface SharedLeg {
    /** W = walk, T = transit */
    m: 'W' | 'T';
    /** Route code, direction and color (transit only) */
    c?: string;
    n?: string;
    k?: string;
    f: Point;
    t: Point;
    /** Planned minutes */
    d: number;
    /** Encoded polyline (precision 5) */
    g: string;
}

export interface SharedTrip {
    v: 1;
    /** Sender's name, optional */
    by?: string;
    to: Point;
    /** Trip start and estimated arrival when shared (epoch seconds) */
    at: number;
    eta: number;
    /** When the link was created (epoch seconds) */
    sh: number;
    /** Leg in progress when shared */
    cur: number;
    /** Label of the bus the sender is on (e.g. "A10072"), when detected */
    bus?: string;
    legs: SharedLeg[];
}

/** What the sender's phone reports while the trip is open (short links only). */
export interface ShareState {
    /** Leg in progress */
    leg: number;
    /** Bus the sender is on, when detected */
    bus: string | null;
    /** Expected arrival (epoch ms) */
    eta: number | null;
    /** When the leg or the bus last changed (epoch ms) */
    since: number;
    /** Last report (epoch ms) */
    at: number;
    ended: boolean;
}

/** Report sent by the sender's phone (the key proves it's the phone that created the link). */
export interface ShareUpdate {
    key: string;
    leg: number;
    bus: string | null;
    eta: number | null;
    ended?: boolean;
    by?: string;
}

// ─── Polyline (Google encoded polyline algorithm, precision 5) ──

function encodeValue(value: number): string {
    let v = value < 0 ? ~(value << 1) : value << 1;
    let out = '';
    while (v >= 0x20) {
        out += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
        v >>= 5;
    }
    return out + String.fromCharCode(v + 63);
}

export function encodePolyline(coords: LngLat[]): string {
    let lastLat = 0, lastLng = 0, out = '';
    for (const [lng, lat] of coords) {
        const la = Math.round(lat * 1e5), ln = Math.round(lng * 1e5);
        out += encodeValue(la - lastLat) + encodeValue(ln - lastLng);
        lastLat = la;
        lastLng = ln;
    }
    return out;
}

export function decodePolyline(str: string): LngLat[] {
    const coords: LngLat[] = [];
    let index = 0, lat = 0, lng = 0;
    while (index < str.length) {
        for (const which of [0, 1]) {
            let result = 0, shift = 0, b: number;
            do {
                b = str.charCodeAt(index++) - 63;
                result |= (b & 0x1f) << shift;
                shift += 5;
            } while (b >= 0x20 && index < str.length);
            const delta = result & 1 ? ~(result >> 1) : result >> 1;
            if (which === 0) lat += delta;
            else lng += delta;
        }
        coords.push([lng / 1e5, lat / 1e5]);
    }
    return coords;
}

// ─── base64url (UTF-8 safe) ──────────────────────────────

function toBase64Url(text: string): string {
    const bytes = new TextEncoder().encode(text);
    let bin = '';
    bytes.forEach((b) => { bin += String.fromCharCode(b); });
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(data: string): string {
    const b64 = data.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((data.length + 3) % 4);
    const bin = atob(b64);
    return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

const round5 = (n: number) => Math.round(n * 1e5) / 1e5;
const point = (name: string, lat: number, lng: number): Point => [name.slice(0, 80), round5(lat), round5(lng)];

// ─── Build / read ────────────────────────────────────────

export interface ShareSnapshot {
    currentLeg: number;
    etaMs: number;
    bus?: string | null;
    by?: string;
}

export function buildSharedTrip(trip: ActiveTrip, opts: ShareSnapshot): SharedTrip {
    return {
        v: 1,
        ...(opts.by?.trim() ? { by: opts.by.trim().slice(0, 40) } : {}),
        to: point(trip.to.name, trip.to.lat, trip.to.lng),
        at: Math.round(new Date(trip.startedAt).getTime() / 1000),
        eta: Math.round(opts.etaMs / 1000),
        sh: Math.round(Date.now() / 1000),
        cur: opts.currentLeg,
        ...(opts.bus ? { bus: opts.bus } : {}),
        legs: trip.itinerary.legs.map((l) => ({
            m: l.mode === 'TRANSIT' ? 'T' : 'W',
            ...(l.line ? { c: l.line.code, n: (l.line.longName || l.line.name).slice(0, 60), k: l.line.color } : {}),
            f: point(l.from.name, l.from.lat, l.from.lng),
            t: point(l.to.name, l.to.lat, l.to.lng),
            d: l.durationMin,
            // ~25 m tolerance keeps the link short and the line recognizable
            g: encodePolyline(simplify(l.geometry, 0.00025)),
        })),
    };
}

/** The whole trip in a link fragment: works without TransMi storing anything, but can't follow transfers. */
export function packTrip(trip: ActiveTrip, opts: ShareSnapshot): string {
    return toBase64Url(JSON.stringify(buildSharedTrip(trip, opts)));
}

export function shareUrl(packed: string): string {
    return `${window.location.origin}/sigue#${packed}`;
}

export function shortShareUrl(id: string): string {
    return `${window.location.origin}/sigue/${id}`;
}

export function unpackTrip(data: string): SharedTrip | null {
    try {
        const trip = JSON.parse(fromBase64Url(data)) as SharedTrip;
        if (trip?.v !== 1 || !Array.isArray(trip.legs) || !trip.legs.length || !Array.isArray(trip.to)) return null;
        return trip;
    } catch {
        return null;
    }
}

/** Rebuild an Itinerary so the regular map component can draw the shared trip. */
export function toItinerary(trip: SharedTrip): { itinerary: Itinerary; from: PlanPlace; to: PlanPlace } {
    const legs: PlanLeg[] = trip.legs.map((l) => {
        const geometry = decodePolyline(l.g);
        const distanceM = geometry.slice(1).reduce((s, c, i) => s + haversine({ lat: geometry[i][1], lng: geometry[i][0] }, { lat: c[1], lng: c[0] }), 0);
        const stop = (p: Point) => ({ id: '', code: '', name: p[0], lat: p[1], lng: p[2] });
        return {
            mode: l.m === 'T' ? 'TRANSIT' : 'WALK',
            durationMin: l.d,
            distanceM,
            distanceText: '',
            from: stop(l.f),
            to: stop(l.t),
            geometry,
            ...(l.m === 'T' && l.c ? { line: { id: '', code: l.c, name: l.c, longName: l.n || '', color: l.k || '#525252', agency: '', kind: 'troncal' as const }, stops: [] } : {}),
        };
    });
    const first = trip.legs[0].f;
    return {
        itinerary: {
            id: 'shared',
            durationMin: legs.reduce((s, l) => s + l.durationMin, 0),
            walkMeters: Math.round(legs.filter((l) => l.mode === 'WALK').reduce((s, l) => s + l.distanceM, 0)),
            walkMin: legs.filter((l) => l.mode === 'WALK').reduce((s, l) => s + l.durationMin, 0),
            transfers: Math.max(0, legs.filter((l) => l.mode === 'TRANSIT').length - 1),
            legs,
            bounds: null,
            tags: [],
        },
        from: { name: first[0], lat: first[1], lng: first[2] },
        to: { name: trip.to[0], lat: trip.to[1], lng: trip.to[2] },
    };
}
