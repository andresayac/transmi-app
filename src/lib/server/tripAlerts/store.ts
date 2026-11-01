import 'server-only';

import { promises as fs } from 'node:fs';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { z } from 'zod/v4';
import type { LatLng } from '@/lib/geo';
import type { AlertTrip } from '@/lib/tripAlerts';
import type { LiveBus } from '@/types/transit';
import { getLiveBuses } from '../transit';
import { dataPath, readJson, removeOld, writeJson } from '../dataDir';
import { applyReport, initialState, step, type WatchState } from './step';
import { isPushEndpoint, sendPush, type PushTarget } from './push';

/**
 * Trips the server watches for "Avisos con TransMi cerrada" (see lib/tripAlerts.ts).
 * One JSON file per trip in DATA_DIR/avisos, cached in memory, deleted when the
 * trip ends or after LIVE_MS. A loop checks the riders' buses every CHECK_EVERY_MS.
 */

const LIVE_MS = 6 * 60 * 60 * 1000;
const CHECK_EVERY_MS = 12000;
const SWEEP_EVERY_MS = 60 * 60 * 1000;
const MAX_WATCHES = 2000;

interface Watch {
    id: string;
    keyHash: string;
    createdAt: number;
    /** Site address the phone registered from (contact for the push services) */
    origin?: string;
    subscription: PushTarget;
    trip: AlertTrip;
    state: WatchState;
}

// ─── Validation ─────────────────────────────────────────

const label = z.string().regex(/^[A-Za-z0-9-]{1,20}$/);

const tripSchema = z.object({
    dest: z.string().max(80),
    legs: z.array(z.object({
        m: z.enum(['W', 'T']),
        c: z.string().min(1).max(20).optional(),
        n: z.string().max(60).optional(),
        to: z.string().max(80),
        s: z.array(z.tuple([z.number().min(-90).max(90), z.number().min(-180).max(180)])).min(2).max(200).optional(),
        d: z.number().min(0).max(600),
    })).min(1).max(30),
});

export const createSchema = z.object({
    subscription: z.object({
        endpoint: z.string().max(1000).refine(isPushEndpoint),
        keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
    }),
    trip: tripSchema,
    leg: z.number().int().min(0).max(30),
    bus: label.nullable(),
    alarmStops: z.number().int().min(1).max(3),
});

export const updateSchema = z.object({
    key: z.string().regex(/^[A-Za-z0-9_-]{32}$/),
    leg: z.number().int().min(0).max(30),
    bus: label.nullable(),
    visible: z.boolean(),
    fired: z.array(z.string().regex(/^(alarm|alight|hint):\d{1,2}$/)).max(100),
    alarmStops: z.number().int().min(1).max(3),
    ended: z.boolean().optional(),
});

export const WATCH_ID = /^[A-Za-z0-9_-]{10}$/;

// ─── Storage ────────────────────────────────────────────

const folder = () => dataPath('avisos');
const file = (id: string) => dataPath('avisos', `${id}.json`);
const hashKey = (key: string) => createHash('sha256').update(key).digest('hex');

// Shared through globalThis: the loop (started from instrumentation) and the API routes are bundled apart
const g = globalThis as typeof globalThis & {
    __tripAlerts?: Map<string, Watch>;
    __tripAlertsLoaded?: Promise<void>;
    __tripAlertsTimer?: ReturnType<typeof setInterval>;
    __tripAlertsBusy?: boolean;
    __tripAlertsSwept?: number;
};
const watches = (g.__tripAlerts ??= new Map<string, Watch>());

const save = (w: Watch) => writeJson(file(w.id), w);

async function remove(id: string) {
    watches.delete(id);
    await fs.unlink(file(id)).catch(() => undefined);
}

/** After a restart, pick up the trips still in progress. */
function loadAll(): Promise<void> {
    g.__tripAlertsLoaded ??= (async () => {
        let names: string[] = [];
        try { names = await fs.readdir(folder()); } catch { return; }
        const now = Date.now();
        await Promise.all(names.filter((n) => n.endsWith('.json')).map(async (name) => {
            const w = await readJson<Watch>(dataPath('avisos', name));
            if (w?.id && !watches.has(w.id) && now - w.createdAt < LIVE_MS) watches.set(w.id, w);
        }));
    })();
    return g.__tripAlertsLoaded;
}

/** Only what matters after a restart is written down; the rest changes on every check. */
const durable = (s: WatchState) => JSON.stringify([s.leg, s.bus, s.legSince, s.fired, s.alarmStops, s.done]);

export async function createWatch(input: z.infer<typeof createSchema>, origin: string | undefined): Promise<{ id: string; key: string } | 'full'> {
    await loadAll();
    startTripAlerts();
    // One trip per phone: a new trip replaces the previous one
    for (const w of [...watches.values()]) if (w.subscription.endpoint === input.subscription.endpoint) await remove(w.id);
    if (watches.size >= MAX_WATCHES) return 'full';

    const now = Date.now();
    let id = '';
    do {
        id = randomBytes(8).toString('base64url').slice(0, 10);
    } while (watches.has(id));
    const key = randomBytes(24).toString('base64url');
    const watch: Watch = {
        id,
        keyHash: hashKey(key),
        createdAt: now,
        ...(origin ? { origin } : {}),
        subscription: input.subscription,
        trip: input.trip,
        state: initialState(input.trip, input.leg, input.bus, input.alarmStops, now),
    };
    await save(watch);
    watches.set(id, watch);
    return { id, key };
}

export type UpdateResult = { result: 'ok'; fired: string[] } | { result: 'ended' | 'not_found' | 'forbidden' };

/** A report from the phone; answers with the alerts already given, so the phone doesn't repeat them. */
export async function updateWatch(id: string, update: z.infer<typeof updateSchema>): Promise<UpdateResult> {
    await loadAll();
    startTripAlerts();
    const watch = WATCH_ID.test(id) ? watches.get(id) : undefined;
    if (!watch) return { result: 'not_found' };
    if (!timingSafeEqual(Buffer.from(hashKey(update.key), 'hex'), Buffer.from(watch.keyHash, 'hex'))) return { result: 'forbidden' };
    if (update.ended) {
        await remove(id);
        return { result: 'ended' };
    }
    const before = durable(watch.state);
    watch.state = applyReport(watch.trip, watch.state, update, Date.now());
    if (durable(watch.state) !== before) await save(watch);
    return { result: 'ok', fired: watch.state.fired };
}

// ─── The loop ───────────────────────────────────────────

async function check() {
    if (g.__tripAlertsBusy) return;
    g.__tripAlertsBusy = true;
    try {
        const now = Date.now();
        // One request per route per check, however many riders are on it
        const feeds = new Map<string, Promise<LiveBus[] | null>>();
        const feed = (code: string) => {
            if (!feeds.has(code)) feeds.set(code, getLiveBuses(code, '').catch(() => null));
            return feeds.get(code)!;
        };

        for (const watch of [...watches.values()]) {
            if (now - watch.createdAt > LIVE_MS) {
                await remove(watch.id);
                continue;
            }
            if (watch.state.done) continue;
            const leg = watch.trip.legs[watch.state.leg];
            let live: LatLng | null | undefined;
            if (leg?.m === 'T' && leg.c && watch.state.bus) {
                const buses = await feed(leg.c);
                live = buses ? buses.find((b) => b.label === watch.state.bus) ?? null : undefined;
            }

            const before = durable(watch.state);
            const { state, push } = step(watch.trip, watch.state, live, now);
            watch.state = state;
            let gone = false;
            for (const message of push) {
                if ((await sendPush(watch.subscription, message, watch.origin)) === 'gone') gone = true;
            }
            if (gone) await remove(watch.id);
            else if (durable(state) !== before) await save(watch);
        }

        if (now - (g.__tripAlertsSwept ?? 0) > SWEEP_EVERY_MS) {
            g.__tripAlertsSwept = now;
            await removeOld(folder(), LIVE_MS, now);
        }
    } catch (err) {
        console.error('[avisos] falló la revisión de viajes', err instanceof Error ? err.message : err);
    } finally {
        g.__tripAlertsBusy = false;
    }
}

/** Start watching (once per process). Called at boot from instrumentation.ts and on every API call. */
export function startTripAlerts() {
    if (g.__tripAlertsTimer) return;
    g.__tripAlertsTimer = setInterval(() => void check(), CHECK_EVERY_MS);
    g.__tripAlertsTimer.unref?.();
    void loadAll();
}
