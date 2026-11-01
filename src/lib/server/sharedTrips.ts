import 'server-only';

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { z } from 'zod/v4';
import type { ShareState, ShareUpdate, SharedTrip } from '@/lib/tripShare';

/**
 * Short "Sigue mi viaje" links. Each shared trip is one small JSON file
 * (DATA_DIR/sigue/<id>.json, default ./.data), cached in memory: no database to
 * install, and links survive restarts. Only the planned trip and the sender's
 * reports (leg, bus number, ETA) are stored, never the phone's location, and
 * files are deleted after KEEP_MS.
 */

const KEEP_MS = 3 * 24 * 60 * 60 * 1000;
/** A live trip can't be updated after this long (matches the follower's 6 h window) */
const LIVE_MS = 6 * 60 * 60 * 1000;
const MIN_UPDATE_MS = 3000;
const SWEEP_EVERY_MS = 60 * 60 * 1000;

export const SHARE_ID = /^[A-Za-z0-9_-]{10}$/;

interface StoredTrip {
    id: string;
    keyHash: string;
    createdAt: number;
    trip: SharedTrip;
    state: ShareState;
}

// ─── Validation ─────────────────────────────────────────

const point = z.tuple([z.string().max(200), z.number().min(-90).max(90), z.number().min(-180).max(180)]);

const tripSchema = z.object({
    v: z.literal(1),
    by: z.string().max(40).optional(),
    to: point,
    at: z.number().int().nonnegative(),
    eta: z.number().int().nonnegative(),
    sh: z.number().int().nonnegative(),
    cur: z.number().int().min(0).max(30),
    bus: z.string().regex(/^[A-Za-z0-9-]{1,20}$/).optional(),
    legs: z.array(z.object({
        m: z.enum(['W', 'T']),
        c: z.string().max(20).optional(),
        n: z.string().max(80).optional(),
        k: z.string().regex(/^#[0-9a-fA-F]{3,8}$/).optional(),
        f: point,
        t: point,
        d: z.number().min(0).max(600),
        g: z.string().max(20000),
    })).min(1).max(30),
});

export const updateSchema = z.object({
    key: z.string().regex(/^[A-Za-z0-9_-]{32}$/),
    leg: z.number().int().min(0).max(30),
    bus: z.string().regex(/^[A-Za-z0-9-]{1,20}$/).nullable(),
    eta: z.number().int().positive().nullable(),
    ended: z.boolean().optional(),
    by: z.string().max(40).optional(),
});

export function parseTrip(input: unknown): SharedTrip | null {
    const parsed = tripSchema.safeParse(input);
    return parsed.success ? (parsed.data as SharedTrip) : null;
}

// ─── Storage ────────────────────────────────────────────

const dir = () => path.join(process.env.DATA_DIR || path.join(process.cwd(), '.data'), 'sigue');
const file = (id: string) => path.join(dir(), `${id}.json`);
const hashKey = (key: string) => createHash('sha256').update(key).digest('hex');

// Survives dev hot reloads; one Node process serves the app, so memory is a valid cache
const g = globalThis as typeof globalThis & { __sharedTrips?: Map<string, StoredTrip>; __sharedTripsSweep?: number };
const cache = (g.__sharedTrips ??= new Map<string, StoredTrip>());

async function save(record: StoredTrip) {
    await fs.mkdir(dir(), { recursive: true });
    const target = file(record.id);
    const temp = `${target}.${process.pid}.tmp`;
    await fs.writeFile(temp, JSON.stringify(record));
    await fs.rename(temp, target);
}

async function sweep(now: number) {
    if (g.__sharedTripsSweep && now - g.__sharedTripsSweep < SWEEP_EVERY_MS) return;
    g.__sharedTripsSweep = now;
    for (const [id, record] of cache) if (now - record.createdAt > KEEP_MS) cache.delete(id);
    let names: string[] = [];
    try { names = await fs.readdir(dir()); } catch { return; }
    await Promise.all(names.map(async (name) => {
        const full = path.join(dir(), name);
        try {
            const { mtimeMs } = await fs.stat(full);
            if (now - mtimeMs > KEEP_MS) await fs.unlink(full);
        } catch { /* already gone */ }
    }));
}

/** Store a trip and return its short id plus the secret key its sender uses to report progress. */
export async function createSharedTrip(trip: SharedTrip): Promise<{ id: string; key: string }> {
    const now = Date.now();
    void sweep(now);
    let id = '';
    do {
        id = randomBytes(8).toString('base64url').slice(0, 10);
    } while (cache.has(id) || (await fs.stat(file(id)).then(() => true, () => false)));
    const key = randomBytes(24).toString('base64url');
    const record: StoredTrip = {
        id,
        keyHash: hashKey(key),
        createdAt: now,
        trip,
        state: { leg: trip.cur, bus: trip.bus ?? null, eta: trip.eta * 1000, since: now, at: now, ended: false },
    };
    await save(record);
    cache.set(id, record);
    return { id, key };
}

async function load(id: string): Promise<StoredTrip | null> {
    if (!SHARE_ID.test(id)) return null;
    const cached = cache.get(id);
    if (cached) return cached;
    try {
        const record = JSON.parse(await fs.readFile(file(id), 'utf8')) as StoredTrip;
        if (Date.now() - record.createdAt > KEEP_MS) return null;
        cache.set(id, record);
        return record;
    } catch {
        return null;
    }
}

export async function getSharedTrip(id: string): Promise<{ trip: SharedTrip; state: ShareState } | null> {
    const record = await load(id);
    return record ? { trip: record.trip, state: record.state } : null;
}

export type UpdateResult = 'ok' | 'not_found' | 'forbidden' | 'closed' | 'too_soon';

/** Progress reported by the sender's phone. The leg and bus "since" moves only when they change. */
export async function updateSharedTrip(id: string, update: ShareUpdate): Promise<UpdateResult> {
    const record = await load(id);
    if (!record) return 'not_found';
    const given = Buffer.from(hashKey(update.key), 'hex');
    if (!timingSafeEqual(given, Buffer.from(record.keyHash, 'hex'))) return 'forbidden';
    const now = Date.now();
    if (record.state.ended || now - record.createdAt > LIVE_MS) return 'closed';

    const prev = record.state;
    const leg = Math.min(update.leg, record.trip.legs.length - 1);
    const changed = leg !== prev.leg || update.bus !== prev.bus;
    // Only repeated heartbeats are throttled: a transfer or a new bus always goes through
    if (!changed && !update.ended && update.by === undefined && now - prev.at < MIN_UPDATE_MS) return 'too_soon';
    record.state = { leg, bus: update.bus, eta: update.eta, since: changed ? now : prev.since, at: now, ended: !!update.ended };
    if (update.by !== undefined) {
        const by = update.by.trim().slice(0, 40);
        const { by: _previous, ...rest } = record.trip;
        void _previous;
        record.trip = by ? { ...rest, by } : rest;
    }
    // A heartbeat with nothing new stays in memory; anything else is written down
    if (changed || update.ended || update.eta !== prev.eta || update.by !== undefined) await save(record);
    return 'ok';
}
