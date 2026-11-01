export type LngLat = [number, number];

export interface LatLng {
    lat: number;
    lng: number;
}

const R = 6371000; // Earth radius (m)
const toRad = (d: number) => (d * Math.PI) / 180;

/** Great-circle distance in meters. */
export function haversine(a: LatLng, b: LatLng): number {
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(s));
}

/** Parse the API's "lat,lng" coordinate strings. */
export function parseCoord(coord?: string | null): LatLng | null {
    if (!coord) return null;
    const [a, b] = coord.split(',').map((v) => parseFloat(v.trim()));
    if (!Number.isFinite(a) || !Number.isFinite(b) || a === 0) return null;
    return { lat: a, lng: b };
}

export function formatDistance(m: number): string {
    if (m < 1000) return `${Math.round(m / 10) * 10} m`;
    return `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`;
}

/** Walking minutes at ~4.8 km/h. */
export function walkMinutes(m: number): number {
    return Math.max(1, Math.round(m / 80));
}

/**
 * Project a point onto a polyline of stops and return the fractional index
 * (e.g. 3.4 = 40% of the way between stop 3 and stop 4) plus the distance
 * from the line in meters. Uses an equirectangular approximation, fine at city scale.
 */
export function projectOnPath(point: LatLng, path: LatLng[]): { index: number; offset: number } {
    if (path.length === 0) return { index: 0, offset: Infinity };
    if (path.length === 1) return { index: 0, offset: haversine(point, path[0]) };

    const k = Math.cos(toRad(point.lat));
    const px = point.lng * k;
    const py = point.lat;

    let best = { index: 0, offset: Infinity };
    for (let i = 0; i < path.length - 1; i++) {
        const ax = path[i].lng * k, ay = path[i].lat;
        const bx = path[i + 1].lng * k, by = path[i + 1].lat;
        const dx = bx - ax, dy = by - ay;
        const len2 = dx * dx + dy * dy;
        const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
        const cx = ax + t * dx, cy = ay + t * dy;
        const offset = haversine(point, { lat: cy, lng: cx / k });
        if (offset < best.offset) best = { index: i + t, offset };
    }
    return best;
}

/** Douglas–Peucker simplification on [lng, lat] arrays (tolerance in degrees). */
export function simplify(coords: LngLat[], tolerance = 0.00003): LngLat[] {
    if (coords.length <= 2) return coords;
    const sqTol = tolerance * tolerance;

    const sqSegDist = (p: LngLat, a: LngLat, b: LngLat) => {
        let x = a[0], y = a[1];
        let dx = b[0] - x, dy = b[1] - y;
        if (dx !== 0 || dy !== 0) {
            const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy);
            if (t > 1) { x = b[0]; y = b[1]; } else if (t > 0) { x += dx * t; y += dy * t; }
        }
        dx = p[0] - x; dy = p[1] - y;
        return dx * dx + dy * dy;
    };

    const keep = new Uint8Array(coords.length);
    keep[0] = keep[coords.length - 1] = 1;
    const stack: [number, number][] = [[0, coords.length - 1]];
    while (stack.length) {
        const [first, last] = stack.pop()!;
        let maxSq = 0, index = 0;
        for (let i = first + 1; i < last; i++) {
            const d = sqSegDist(coords[i], coords[first], coords[last]);
            if (d > maxSq) { index = i; maxSq = d; }
        }
        if (maxSq > sqTol) {
            keep[index] = 1;
            stack.push([first, index], [index, last]);
        }
    }
    return coords.filter((_, i) => keep[i]).map(([x, y]) => [+x.toFixed(6), +y.toFixed(6)] as LngLat);
}

/** Bounds as [[minLng, minLat], [maxLng, maxLat]]. */
export function boundsOf(coords: LngLat[]): [LngLat, LngLat] | null {
    if (!coords.length) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [x, y] of coords) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
    }
    return [[minX, minY], [maxX, maxY]];
}

/** Linear interpolation between two coordinates. */
export function lerpLngLat(a: LngLat, b: LngLat, t: number): LngLat {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

/**
 * Order unordered stations along their corridor: start at one end of the main
 * axis (principal component), then chain nearest neighbours. Works for straight
 * and gently curved troncales; items without coordinates keep their order at the end.
 */
export function orderAlongLine<T>(items: T[], coordOf: (item: T) => LatLng | null): T[] {
    const withC = items.map((item) => ({ item, c: coordOf(item) })).filter((x): x is { item: T; c: LatLng } => !!x.c);
    const without = items.filter((item) => !coordOf(item));
    if (withC.length < 3) return [...withC.map((x) => x.item), ...without];

    const k = Math.cos(toRad(withC[0].c.lat));
    const pts = withC.map((x) => ({ ...x, x: x.c.lng * k, y: x.c.lat }));
    const mx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
    const my = pts.reduce((s, p) => s + p.y, 0) / pts.length;
    let sxx = 0, sxy = 0, syy = 0;
    for (const p of pts) {
        sxx += (p.x - mx) ** 2;
        sxy += (p.x - mx) * (p.y - my);
        syy += (p.y - my) ** 2;
    }
    const angle = 0.5 * Math.atan2(2 * sxy, sxx - syy);
    const ax = Math.cos(angle), ay = Math.sin(angle);
    // Start at the north/west-most end so lines read like the official maps
    let start = pts.reduce((best, p) => ((p.x - mx) * ax + (p.y - my) * ay > (best.x - mx) * ax + (best.y - my) * ay ? p : best));
    if (ay < 0) start = pts.reduce((best, p) => ((p.x - mx) * ax + (p.y - my) * ay < (best.x - mx) * ax + (best.y - my) * ay ? p : best));

    const ordered = [start];
    const left = new Set(pts.filter((p) => p !== start));
    while (left.size) {
        const last = ordered[ordered.length - 1];
        let next: typeof start | null = null;
        let best = Infinity;
        for (const p of left) {
            const d = (p.x - last.x) ** 2 + (p.y - last.y) ** 2;
            if (d < best) { best = d; next = p; }
        }
        ordered.push(next!);
        left.delete(next!);
    }
    return [...ordered.map((p) => p.item), ...without];
}

export const BOGOTA_BBOX: [number, number, number, number] = [-74.25, 4.45, -73.98, 4.85];
