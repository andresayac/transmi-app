'use client';

import { speak as speakNeural, unlockSpeech } from '@/lib/speech';

let audioCtx: AudioContext | null = null;

function ctx(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    if (!audioCtx) audioCtx = new Ctor();
    return audioCtx;
}

/** Call from a user gesture so later chimes and speech are allowed to play. */
export function unlockAudio() {
    const c = ctx();
    if (c?.state === 'suspended') c.resume().catch(() => { /* not allowed yet */ });
    unlockSpeech();
}

/** Two rising tones, like a station chime. Synthesized: no audio files. */
export function chime() {
    const c = ctx();
    if (!c) return;
    if (c.state === 'suspended') c.resume().catch(() => { /* blocked */ });
    const now = c.currentTime;
    [880, 1318.5].forEach((freq, i) => {
        const osc = c.createOscillator();
        const gain = c.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const t0 = now + i * 0.22;
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.exponentialRampToValueAtTime(0.35, t0 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.6);
        osc.connect(gain).connect(c.destination);
        osc.start(t0);
        osc.stop(t0 + 0.65);
    });
}

export function vibrate(pattern: number[] = [220, 90, 220, 90, 420]) {
    try {
        navigator.vibrate?.(pattern);
    } catch { /* unsupported */ }
}

/** Announcements use the chosen Edge neural voice (falls back to the browser voice offline). */
export function speak(text: string) {
    void speakNeural(text);
}

/** The tag matches the server's push for the same alert (see lib/tripAlerts.ts), so only one shows. */
export async function notify(title: string, body: string, tag = 'transmi-trip') {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const options: NotificationOptions = { body, tag, icon: '/icon-192.png', badge: '/icon-192.png' };
    try {
        const reg = await navigator.serviceWorker?.getRegistration();
        if (reg) {
            await reg.showNotification(title, options);
            return;
        }
    } catch { /* fall back below */ }
    try {
        new Notification(title, options);
    } catch { /* Android Chrome only allows SW notifications */ }
}

export function notificationsState(): NotificationPermission | 'unsupported' {
    if (typeof Notification === 'undefined') return 'unsupported';
    return Notification.permission;
}
