import type { ActiveTrip } from '@/stores/app';
import { stopLabel } from '@/components/plan/utils';

/**
 * "Avisos con TransMi cerrada": phones freeze a web app as soon as you switch
 * to another app or lock the screen, so its GPS and alarms stop. Instead,
 * TransMi's server follows the *bus* the rider is on (TransMilenio's live bus
 * positions, never the phone's location) and sends a push notification when
 * it nears the stop where the rider gets off.
 *
 * The phone registers the planned trip and reports which leg it's on, which
 * bus it took (once recognized), whether TransMi is on screen (then the phone
 * alerts by itself), and which alerts it already gave.
 */

export interface AlertLeg {
    /** W = walk, T = transit */
    m: 'W' | 'T';
    /** Route code and direction (transit only) */
    c?: string;
    n?: string;
    /** Where the leg ends, ready to read ("Calle 72") */
    to: string;
    /** Transit: boarding stop, intermediate stops, alighting stop, as [lat, lng] */
    s?: [number, number][];
    /** Planned minutes */
    d: number;
}

export interface AlertTrip {
    legs: AlertLeg[];
    dest: string;
}

/** Report from the phone (the key proves it's the phone that registered the trip). */
export interface AlertUpdate {
    key: string;
    leg: number;
    /** Bus the rider is on for this leg, once recognized */
    bus: string | null;
    /** TransMi is on screen: the phone gives the alerts itself */
    visible: boolean;
    /** Alerts already given ("alarm:1", "alight:1") */
    fired: string[];
    alarmStops: number;
    ended?: boolean;
}

/** Same tag for the same alert, on the phone and from the server: the second one replaces the first silently. */
export const alertTag = (kind: 'alarm' | 'alight' | 'hint', leg: number) => `trip-${kind}-${leg}`;

const round5 = (n: number) => Math.round(n * 1e5) / 1e5;

export function buildAlertTrip(trip: ActiveTrip): AlertTrip {
    const legs = trip.itinerary.legs;
    return {
        dest: trip.to.name.slice(0, 80),
        legs: legs.map((l, i) => {
            const to = (i === legs.length - 1 ? trip.to.name : stopLabel(l.to.name).station).slice(0, 80);
            if (l.mode !== 'TRANSIT') return { m: 'W' as const, to, d: l.durationMin };
            return {
                m: 'T' as const,
                ...(l.line ? { c: l.line.code, n: (l.line.longName || l.line.name).slice(0, 60) } : {}),
                to,
                s: [l.from, ...(l.stops || []), l.to].map((s) => [round5(s.lat), round5(s.lng)] as [number, number]),
                d: l.durationMin,
            };
        }),
    };
}
