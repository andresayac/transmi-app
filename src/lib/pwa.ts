'use client';

export function isStandalone(): boolean {
    return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function isIOS(): boolean {
    return /iPhone|iPad|iPod/i.test(navigator.userAgent) && !/CriOS|FxiOS|EdgiOS/i.test(navigator.userAgent);
}

/**
 * Can this phone get notifications while TransMi is closed?
 * "install": iPhone allows it only once TransMi is on the home screen (iOS 16.4+).
 */
export function pushSupport(): 'ok' | 'install' | 'unsupported' {
    if ('serviceWorker' in navigator && 'PushManager' in window && typeof Notification !== 'undefined') return 'ok';
    return isIOS() && !isStandalone() ? 'install' : 'unsupported';
}

function base64UrlBytes(value: string): Uint8Array<ArrayBuffer> {
    const b64 = value.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((value.length + 3) % 4);
    return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

function sameBytes(a: ArrayBuffer | null, b: Uint8Array): boolean {
    if (!a || a.byteLength !== b.length) return false;
    const view = new Uint8Array(a);
    return view.every((v, i) => v === b[i]);
}

const SW_READY_MS = 8000;

/**
 * This phone's push subscription for TransMi's server. Reuses the existing one
 * unless the server's key changed. Needs notification permission already granted.
 */
export async function pushSubscription(): Promise<PushSubscriptionJSON> {
    const res = await fetch('/api/avisos', { cache: 'no-store' });
    if (!res.ok) throw new Error(`avisos ${res.status}`);
    const key = base64UrlBytes(((await res.json()) as { publicKey: string }).publicKey);

    // The service worker only runs in production builds (see ServiceWorkerRegistration)
    const reg = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('sin service worker')), SW_READY_MS)),
    ]);
    let sub = await reg.pushManager.getSubscription();
    if (sub && !sameBytes(sub.options.applicationServerKey, key)) {
        await sub.unsubscribe().catch(() => false);
        sub = null;
    }
    sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
    return sub.toJSON();
}
