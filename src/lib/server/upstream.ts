import 'server-only';

/**
 * Single place for the upstream TransMilenio services the official app uses:
 *  - loader:  api.buscador-rutas.transmilenio.gov.co (catalog: routes, stations, schedules)
 *  - bodega:  tmsa-transmiapp (live buses, ETAs, arrivals, card balance, recharge points)
 *  - planner: planeador.transmilenio.gov.co (OpenTripPlanner)
 */

const LOADER_BASE = 'https://api.buscador-rutas.transmilenio.gov.co/loader.php';
const BODEGA_BASE = 'https://tmsa-transmiapp-shvpc.uc.r.appspot.com';
const PLANNER_BASE = 'https://planeador.transmilenio.gov.co/otp/routers/default/plan2';

const PROXY_BASE = process.env.PROXY_BASE || '';
const BUS_API_TOKEN = process.env.BUS_API_TOKEN || '';

const APP_ID = '9a2c3b48f0c24ae9bfba38e94f27c3ea';
const DEVICE_UUID = '951d0eaf-daaf-464f-8baf-1d00fe09a01b';
const APP_VERSION = '2.7.6';

const LOADER_HEADERS: Record<string, string> = {
    'Host': 'api.buscador-rutas.transmilenio.gov.co',
    'Appid': APP_ID,
    'Accept-Encoding': 'gzip',
    'User-Agent': 'okhttp/4.12.0',
    'uuid': DEVICE_UUID,
    'version': APP_VERSION,
    'Content-Type': 'application/json',
};

const BODEGA_HEADERS: Record<string, string> = {
    'Content-Type': 'application/json; charset=UTF-8',
    'Host': 'tmsa-transmiapp-shvpc.uc.r.appspot.com',
    'Appid': APP_ID,
    'User-Agent': 'okhttp/4.12.0',
    'uuid': DEVICE_UUID,
    'version': APP_VERSION,
    'x-auth-token': BUS_API_TOKEN,
};

export class UpstreamError extends Error {
    constructor(message: string, public status: number) {
        super(message);
    }
}

const DEFAULT_TIMEOUT = 15000;

async function readJson<T>(response: Response, label: string): Promise<T> {
    const text = await response.text();
    if (!response.ok) throw new UpstreamError(`${label} responded ${response.status}`, response.status);
    try {
        return JSON.parse(text) as T;
    } catch {
        throw new UpstreamError(`${label} returned invalid JSON`, 502);
    }
}

/** GET a loader.php function, e.g. loader('infoRuta', { idRuta, nombre, codigo }). */
export async function loader<T = unknown>(fn: string, params: Record<string, string> = {}, revalidate = 300): Promise<T> {
    const qs = new URLSearchParams({ lServicio: 'Rutas', lTipo: 'api', lFuncion: fn, ...params });
    const response = await fetch(`${LOADER_BASE}?${qs.toString()}`, {
        headers: LOADER_HEADERS,
        next: { revalidate },
        signal: AbortSignal.timeout(DEFAULT_TIMEOUT),
    });
    return readJson<T>(response, `loader:${fn}`);
}

/** Call the live-data service. Goes through PROXY_BASE when configured (needed outside Colombia). */
export async function bodega<T = unknown>(
    path: string,
    init: { method?: 'GET' | 'POST'; body?: unknown; query?: Record<string, string>; revalidate?: number } = {},
): Promise<T> {
    const qs = init.query ? `?${new URLSearchParams(init.query).toString()}` : '';
    const target = `${BODEGA_BASE}/${path.replace(/^\//, '')}${qs}`;
    const url = PROXY_BASE ? `${PROXY_BASE}?url=${encodeURIComponent(target)}` : target;
    const response = await fetch(url, {
        method: init.method || 'GET',
        headers: BODEGA_HEADERS,
        body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
        ...(init.revalidate ? { next: { revalidate: init.revalidate } } : { cache: 'no-store' as const }),
        signal: AbortSignal.timeout(DEFAULT_TIMEOUT),
    });
    return readJson<T>(response, `bodega:${path}`);
}

/** OpenTripPlanner. Called directly: the planner rejects requests coming through the proxy. */
export async function planner<T = unknown>(params: Record<string, string>): Promise<T> {
    const qs = new URLSearchParams({ lServicio: 'Rutas', lTipo: 'api', lFuncion: 'consultarCache', lenguaje: 'es', ...params });
    const response = await fetch(`${PLANNER_BASE}?${qs.toString()}`, {
        headers: { uuid: DEVICE_UUID, version: APP_VERSION },
        next: { revalidate: 60 },
        signal: AbortSignal.timeout(25000),
    });
    return readJson<T>(response, 'planner');
}

/** Tiny in-memory TTL cache for expensive server-side aggregations. */
const memo = new Map<string, { value: unknown; expires: number; pending?: Promise<unknown> }>();

export async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
    const hit = memo.get(key);
    const now = Date.now();
    if (hit && hit.expires > now) return hit.value as T;
    if (hit?.pending) return hit.pending as Promise<T>;

    const pending = load()
        .then((value) => {
            memo.set(key, { value, expires: Date.now() + ttlMs });
            return value;
        })
        .catch((err) => {
            // Serve stale data on failure when we have it
            if (hit) {
                memo.set(key, { value: hit.value, expires: Date.now() + 60000 });
                return hit.value as T;
            }
            memo.delete(key);
            throw err;
        });
    memo.set(key, { value: hit?.value, expires: hit?.expires ?? 0, pending });
    return pending;
}
