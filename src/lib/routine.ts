import { haversine } from '@/lib/geo';
import type { PlanPlace } from '@/types/transit';

/**
 * "Where is this person probably going now?" — guessed on the device from the
 * trips they've finished and their saved Casa / Trabajo. No server, no history
 * leaves the phone.
 */

export interface RoutineTrip {
    startedAt: string;
    toPlace?: PlanPlace;
}

export interface RoutineSuggestion {
    place: PlanPlace;
    /** Card title, e.g. "Hacia el trabajo" */
    title: string;
    reason: 'learned' | 'home' | 'work';
}

interface Input {
    now: Date;
    home: PlanPlace | null;
    work: PlanPlace | null;
    trips: RoutineTrip[];
    /** Current position, when known */
    here?: { lat: number; lng: number } | null;
}

/** Already there (or close enough that a trip makes no sense) */
const AT_PLACE_M = 400;
/** Two destinations closer than this are the same place */
const SAME_PLACE_M = 300;
/** How far from the usual departure time a trip still counts */
const WINDOW_MIN = 75;
const LOOKBACK_DAYS = 60;

const minutesOfDay = (d: Date) => d.getHours() * 60 + d.getMinutes();
const isWeekend = (d: Date) => d.getDay() === 0 || d.getDay() === 6;
const circularDiff = (a: number, b: number) => Math.min(Math.abs(a - b), 1440 - Math.abs(a - b));

function near(a: { lat: number; lng: number } | null | undefined, b: { lat: number; lng: number } | null | undefined, meters: number) {
    return !!a && !!b && haversine(a, b) < meters;
}

function titleFor(place: PlanPlace, home: PlanPlace | null, work: PlanPlace | null): { title: string; reason: RoutineSuggestion['reason'] } {
    if (near(place, home, SAME_PLACE_M)) return { title: 'Hacia casa', reason: 'home' };
    if (near(place, work, SAME_PLACE_M)) return { title: 'Hacia el trabajo', reason: 'work' };
    return { title: `Hacia ${place.name}`, reason: 'learned' };
}

/** Destinations this person repeatedly travels to around this time, on this kind of day. */
function learned({ now, trips }: Input): PlanPlace | null {
    const nowMin = minutesOfDay(now);
    const weekend = isWeekend(now);
    const since = now.getTime() - LOOKBACK_DAYS * 86400000;
    const groups: { place: PlanPlace; count: number; last: number }[] = [];

    for (const t of trips) {
        if (!t.toPlace) continue;
        const started = new Date(t.startedAt);
        const at = started.getTime();
        if (Number.isNaN(at) || at < since) continue;
        if (isWeekend(started) !== weekend) continue;
        if (circularDiff(minutesOfDay(started), nowMin) > WINDOW_MIN) continue;
        const group = groups.find((g) => near(g.place, t.toPlace, SAME_PLACE_M));
        if (group) {
            group.count++;
            group.last = Math.max(group.last, at);
        } else {
            groups.push({ place: t.toPlace, count: 1, last: at });
        }
    }

    const best = groups.filter((g) => g.count >= 2).sort((a, b) => b.count - a.count || b.last - a.last)[0];
    return best?.place || null;
}

export function suggestRoutine(input: Input): RoutineSuggestion | null {
    const { now, home, work, here } = input;
    const candidates: PlanPlace[] = [];

    const fromHabit = learned(input);
    if (fromHabit) candidates.push(fromHabit);

    // Fallback: the classic commute on weekdays
    if (!isWeekend(now)) {
        const m = minutesOfDay(now);
        if (work && m >= 5 * 60 && m < 10 * 60 + 30) candidates.push(work);
        if (home && m >= 15 * 60 && m < 22 * 60 + 30) candidates.push(home);
    }

    const place = candidates.find((p) => !near(here, p, AT_PLACE_M));
    if (!place) return null;
    return { place, ...titleFor(place, home, work) };
}

/**
 * Minutes until the rider should walk out the door: the next bus at the boarding
 * station minus the walk to reach it. Negative means that bus is already missed.
 */
export function leaveInMinutes(nextBusMin: number, walkMin: number, bufferMin = 1): number {
    return nextBusMin - walkMin - bufferMin;
}
