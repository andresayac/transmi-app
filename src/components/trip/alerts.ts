'use client';

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
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.getVoices();
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

function pickVoice(): SpeechSynthesisVoice | null {
    const voices = window.speechSynthesis.getVoices();
    return voices.find((v) => v.lang === 'es-CO')
        || voices.find((v) => v.lang?.startsWith('es-4') || v.lang === 'es-MX' || v.lang === 'es-US')
        || voices.find((v) => v.lang?.startsWith('es'))
        || null;
}

export function speak(text: string) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'es-CO';
    const voice = pickVoice();
    if (voice) utter.voice = voice;
    utter.rate = 1;
    synth.speak(utter);
}

export async function notify(title: string, body: string) {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const options: NotificationOptions = { body, tag: 'transmi-trip', icon: '/icon-192.png', badge: '/icon-192.png' };
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
