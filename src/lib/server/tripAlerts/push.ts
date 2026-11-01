import 'server-only';

import webpush from 'web-push';
import { dataPath, readJson, writeJson } from '../dataDir';
import type { PushMessage } from './step';

export interface PushTarget {
    endpoint: string;
    keys: { p256dh: string; auth: string };
}

interface VapidKeys {
    publicKey: string;
    privateKey: string;
}

const g = globalThis as typeof globalThis & { __vapidKeys?: Promise<VapidKeys> };

/**
 * VAPID keys identify TransMi to the phones' push services. Taken from the
 * environment, or generated once and kept in DATA_DIR/vapid.json (if they
 * change, phones subscribe again on their next trip).
 */
export function vapidKeys(): Promise<VapidKeys> {
    g.__vapidKeys ??= (async () => {
        const { VAPID_PUBLIC_KEY: publicKey, VAPID_PRIVATE_KEY: privateKey } = process.env;
        if (publicKey && privateKey) return { publicKey, privateKey };
        const file = dataPath('vapid.json');
        const saved = await readJson<VapidKeys>(file);
        if (saved?.publicKey && saved.privateKey) return saved;
        const keys = webpush.generateVAPIDKeys();
        await writeJson(file, keys);
        return keys;
    })().catch((err) => {
        g.__vapidKeys = undefined;
        throw err;
    });
    return g.__vapidKeys;
}

// Only the browsers' own push services: a subscription can't make the server call anywhere else
const PUSH_HOSTS = /(^|\.)(fcm\.googleapis\.com|android\.googleapis\.com|push\.services\.mozilla\.com|push\.apple\.com|notify\.windows\.com)$/;

export function isPushEndpoint(url: string): boolean {
    try {
        const u = new URL(url);
        return u.protocol === 'https:' && PUSH_HOSTS.test(u.hostname);
    } catch {
        return false;
    }
}

/** Contact the push services can reach: VAPID_SUBJECT, else the site's own https address. */
function subject(origin: string | undefined): string {
    if (process.env.VAPID_SUBJECT) return process.env.VAPID_SUBJECT;
    if (origin && /^https:\/\//.test(origin) && !/localhost|127\.0\.0\.1/.test(origin)) return origin;
    return 'mailto:avisos@transmi.invalid';
}

/** "gone": the phone unsubscribed (or uninstalled): stop watching that trip. */
export async function sendPush(target: PushTarget, message: PushMessage, origin: string | undefined): Promise<'sent' | 'gone' | 'failed'> {
    const { publicKey, privateKey } = await vapidKeys();
    try {
        await webpush.sendNotification(target, JSON.stringify({ ...message, url: '/viaje' }), {
            vapidDetails: { subject: subject(origin), publicKey, privateKey },
            // A "get off" that arrives minutes late is worse than none
            TTL: 120,
            urgency: 'high',
            timeout: 10000,
        });
        return 'sent';
    } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) return 'gone';
        console.error('[avisos] no se pudo enviar el aviso', status ?? (err instanceof Error ? err.message : err));
        return 'failed';
    }
}
