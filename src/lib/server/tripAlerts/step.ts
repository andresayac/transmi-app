import { haversine, projectOnPath, type LatLng } from '@/lib/geo';
import { alertTag, type AlertTrip, type AlertUpdate } from '@/lib/tripAlerts';

/** What the server knows about a trip it watches. */
export interface WatchState {
    /** Leg in progress: the phone's report, or the server's once it saw the bus reach the stop */
    leg: number;
    /** Bus the rider is on for this leg, as recognized by the phone */
    bus: string | null;
    /** When the current leg began (epoch ms) */
    legSince: number;
    /** Furthest fractional stop index the bus reached on this leg */
    progress: number;
    /** Alerts already given, by the phone or by push ("alarm:1", "alight:1", "hint:3") */
    fired: string[];
    /** TransMi on screen: the phone gives the alerts itself */
    visible: boolean;
    /** Last report from the phone (epoch ms) */
    seenAt: number;
    /** Checks in a row the bus was missing from the live feed */
    missing: number;
    alarmStops: number;
    /** No bus rides left to watch */
    done: boolean;
}

export interface PushMessage {
    title: string;
    body: string;
    tag: string;
}

/** Without news from the phone for this long, it's frozen in the background: the server takes over */
export const PHONE_STALE_MS = 75 * 1000;
/** "Get off" goes out this far before the stop: the bus feed lags and the push takes a moment */
const ALIGHT_M = 300;
/** A reading this far from the ride is a GPS glitch or another branch of the route */
const OFF_ROUTE_M = 500;
/** ~4 minutes without the bus in the feed: fall back to the timetable */
const LOST_CHECKS = 20;
/** Guess for the wait at the stop, when the bus isn't known */
const WAIT_GUESS_MIN = 4;

const hasRidesFrom = (trip: AlertTrip, leg: number) => trip.legs.slice(leg).some((l) => l.m === 'T');

export function initialState(trip: AlertTrip, leg: number, bus: string | null, alarmStops: number, now: number): WatchState {
    const at = Math.min(Math.max(0, leg), trip.legs.length - 1);
    return {
        leg: at,
        bus: trip.legs[at]?.m === 'T' ? bus : null,
        legSince: now,
        progress: 0,
        fired: [],
        visible: true,
        seenAt: now,
        missing: 0,
        alarmStops: clampStops(alarmStops),
        done: !hasRidesFrom(trip, at),
    };
}

const clampStops = (n: number) => Math.min(3, Math.max(1, Math.round(n) || 2));

function startLeg(s: WatchState, trip: AlertTrip, leg: number, now: number) {
    s.leg = leg;
    s.bus = null;
    s.progress = 0;
    s.missing = 0;
    s.legSince = now;
    s.done = !hasRidesFrom(trip, leg);
}

/** Merge a report from the phone. The leg only moves forward; a bus counts for the leg the server is on. */
export function applyReport(trip: AlertTrip, prev: WatchState, report: AlertUpdate, now: number): WatchState {
    const s: WatchState = { ...prev };
    const leg = Math.min(Math.max(0, report.leg), trip.legs.length - 1);
    if (leg > s.leg) startLeg(s, trip, leg, now);
    if (leg === s.leg && trip.legs[leg].m === 'T' && report.bus !== s.bus) {
        s.bus = report.bus;
        s.progress = 0;
        s.missing = 0;
    }
    s.fired = [...new Set([...prev.fired, ...report.fired])].slice(-100);
    s.visible = report.visible;
    s.seenAt = now;
    s.alarmStops = clampStops(report.alarmStops);
    return s;
}

function metersToEnd(stops: LatLng[], from: number): number {
    const last = stops.length - 1;
    const i = Math.floor(from);
    if (i >= last) return 0;
    let m = haversine(stops[i], stops[i + 1]) * (1 - (from - i));
    for (let k = i + 1; k < last; k++) m += haversine(stops[k], stops[k + 1]);
    return m;
}

/** What comes after getting off, so the notification alone is enough to keep going. */
function nextStep(trip: AlertTrip, leg: number): string {
    const rest = trip.legs.slice(leg + 1);
    const ride = rest.findIndex((l) => l.m === 'T');
    if (ride === -1) {
        const walk = rest.reduce((m, l) => m + l.d, 0);
        return walk > 0 ? `Luego camina ${walk} min hasta ${trip.dest}.` : '';
    }
    const next = rest[ride];
    const route = next.c ? `el ${next.c}${next.n ? ` hacia ${next.n}` : ''}` : 'el siguiente bus';
    const where = ride === 0 ? 'ahí mismo' : `en ${rest[ride - 1].to}`;
    return `Luego toma ${route} ${where}. Abre TransMi al subir y te aviso dónde bajarte.`;
}

/**
 * One check of a watched trip.
 * `live`: the bus position; null when the feed answered without that bus;
 * undefined when there's nothing to read (no bus known, or the feed failed).
 * Pushes only go out while the phone is away; on screen, the phone alerts by itself.
 */
export function step(trip: AlertTrip, prev: WatchState, live: LatLng | null | undefined, now: number): { state: WatchState; push: PushMessage[] } {
    const s: WatchState = { ...prev, fired: [...prev.fired] };
    const push: PushMessage[] = [];
    const leg = trip.legs[s.leg];
    if (s.done || !leg) return { state: s, push };

    const away = !s.visible || now - s.seenAt > PHONE_STALE_MS;
    const give = (kind: 'alarm' | 'alight' | 'hint', title: string, body: string) => {
        const key = `${kind}:${s.leg}`;
        if (!away || s.fired.includes(key)) return;
        s.fired.push(key);
        push.push({ title, body, tag: alertTag(kind, s.leg) });
    };

    if (leg.m === 'W') {
        // Nobody can see the phone walk: assume it takes as long as planned
        if (away && now - s.legSince >= leg.d * 60000) startLeg(s, trip, s.leg + 1, now);
        return { state: s, push };
    }

    const stops = (leg.s ?? []).map(([lat, lng]) => ({ lat, lng }));
    const last = stops.length - 1;

    if (s.bus && live) {
        s.missing = 0;
        const { index, offset } = projectOnPath(live, stops);
        if (last > 0 && offset <= OFF_ROUTE_M) {
            s.progress = Math.max(s.progress, index);
            const left = last - Math.floor(s.progress);
            if (left <= 1 && metersToEnd(stops, s.progress) <= ALIGHT_M) {
                give('alight', 'Bájate aquí', `${leg.to}. ${nextStep(trip, s.leg)}`.trim());
                startLeg(s, trip, s.leg + 1, now);
                return { state: s, push };
            }
            if (left >= 1 && left <= s.alarmStops) {
                give('alarm', 'Prepárate para bajarte', `Te bajas en ${left === 1 ? 'la próxima parada' : `${left} paradas`}: ${leg.to}`);
            }
        }
    } else if (s.bus && live === null) {
        s.missing++;
    }

    // Bus unknown (or lost): one reminder from the timetable, worded as the guess it is
    const following = !!s.bus && s.missing < LOST_CHECKS;
    if (!following && !s.fired.includes(`alarm:${s.leg}`)) {
        const perStopMs = (leg.d * 60000) / Math.max(1, last);
        const lead = Math.max(2 * 60000, s.alarmStops * perStopMs);
        if (now >= s.legSince + (WAIT_GUESS_MIN + leg.d) * 60000 - lead) {
            give('hint', 'Revisa tu parada', `Por el tiempo, ya deberías ir llegando a ${leg.to}, donde te bajas. Abre TransMi para avisarte justo a tiempo.`);
        }
    }
    return { state: s, push };
}
