import type { Itinerary, PlanLeg, PlanPlace } from '@/types/transit';
import { LatLng, haversine, projectOnPath } from '@/lib/geo';

interface LegModel {
    leg: PlanLeg;
    path: LatLng[];
    /** Cumulative meters at each path vertex */
    cum: number[];
    length: number;
    /** Transit legs: boarding stop, intermediates, alighting stop */
    stops: LatLng[];
}

export interface TripModel {
    legs: LegModel[];
    dest: LatLng;
    totalMin: number;
}

export interface TrackState {
    /** Last position processed ("lat,lng") */
    key: string;
    legIndex: number;
    legProgressM: number;
    /** Fractional stop index within the current transit leg */
    stopProgress: number;
    /** Distance from the planned route, meters */
    offsetM: number;
    arrived: boolean;
}

export const INITIAL_TRACK: TrackState = { key: '', legIndex: 0, legProgressM: 0, stopProgress: 0, offsetM: 0, arrived: false };

const ARRIVAL_RADIUS_M = 80;

function cumulative(path: LatLng[]): number[] {
    const cum = [0];
    for (let i = 1; i < path.length; i++) cum.push(cum[i - 1] + haversine(path[i - 1], path[i]));
    return cum;
}

export function buildTripModel(itinerary: Itinerary, to: PlanPlace): TripModel {
    const legs = itinerary.legs.map((leg) => {
        let path: LatLng[] = leg.geometry.map(([lng, lat]) => ({ lat, lng }));
        if (path.length < 2) path = [{ lat: leg.from.lat, lng: leg.from.lng }, { lat: leg.to.lat, lng: leg.to.lng }];
        const cum = cumulative(path);
        const stops = leg.mode === 'TRANSIT'
            ? [leg.from, ...(leg.stops || []), leg.to].map((s) => ({ lat: s.lat, lng: s.lng }))
            : [];
        return { leg, path, cum, length: cum[cum.length - 1] || 1, stops };
    });
    return { legs, dest: { lat: to.lat, lng: to.lng }, totalMin: itinerary.durationMin };
}

function projectLeg(model: TripModel, i: number, p: LatLng) {
    const lm = model.legs[i];
    const { index, offset } = projectOnPath(p, lm.path);
    const base = Math.floor(index);
    const next = Math.min(base + 1, lm.cum.length - 1);
    const along = lm.cum[base] + (index - base) * (lm.cum[next] - lm.cum[base]);
    return { offset, along };
}

/**
 * Move the tracker forward with a new GPS fix. Progress only moves forward
 * (GPS jitter at a station shouldn't send you back a stop), and we only jump
 * to a later leg when the fix clearly belongs to it.
 */
export function advance(prev: TrackState, p: LatLng, model: TripModel, key: string): TrackState {
    const last = model.legs.length - 1;
    if (last < 0) return { ...prev, key };

    if (haversine(p, model.dest) <= ARRIVAL_RADIUS_M) {
        const lm = model.legs[last];
        return { key, legIndex: last, legProgressM: lm.length, stopProgress: Math.max(0, lm.stops.length - 1), offsetM: 0, arrived: true };
    }

    let legIndex = prev.legIndex;
    let best = projectLeg(model, legIndex, p);
    const currentFrac = Math.max(prev.legProgressM, best.along) / model.legs[legIndex].length;

    for (let i = prev.legIndex + 1; i <= Math.min(prev.legIndex + 2, last); i++) {
        const candidate = projectLeg(model, i, p);
        const clearlyCloser = candidate.offset + 25 < best.offset;
        const handOff = currentFrac >= 0.85 && candidate.offset < 60 && candidate.offset <= best.offset + 30;
        if (clearlyCloser || handOff) {
            legIndex = i;
            best = candidate;
        }
    }

    const sameLeg = legIndex === prev.legIndex;
    const lm = model.legs[legIndex];
    const legProgressM = Math.min(lm.length, sameLeg ? Math.max(prev.legProgressM, best.along) : best.along);

    let stopProgress = 0;
    if (lm.stops.length > 1) {
        const sp = projectOnPath(p, lm.stops).index;
        stopProgress = sameLeg ? Math.max(prev.stopProgress, sp) : sp;
    }

    return { key, legIndex, legProgressM, stopProgress, offsetM: best.offset, arrived: prev.arrived };
}

/** Minutes left: the unfinished part of the current leg plus every later leg. */
export function remainingMinutes(model: TripModel, track: TrackState): number {
    if (track.arrived) return 0;
    let total = 0;
    model.legs.forEach((lm, i) => {
        if (i < track.legIndex) return;
        if (i === track.legIndex) total += lm.leg.durationMin * (1 - Math.min(1, track.legProgressM / lm.length));
        else total += lm.leg.durationMin;
    });
    return Math.max(0, Math.round(total));
}

/** Meters left on the current leg. */
export function legRemainingM(model: TripModel, track: TrackState): number {
    const lm = model.legs[track.legIndex];
    return lm ? Math.max(0, lm.length - track.legProgressM) : 0;
}

/** "B13" → "B 13" so speech engines read the letter and the number separately. */
export function speakableCode(code: string): string {
    return code.replace(/^([A-Za-z])(\d)/, '$1 $2');
}
