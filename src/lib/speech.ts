'use client';

import { useAppStore } from '@/stores/app';
import { DEFAULT_TTS_VOICE, isKnownVoice, TTS_MAX_CHARS } from '@/lib/voices';
import { isDataSaver } from '@/lib/dataSaver';

/**
 * App-wide speech output with Edge's neural voices (served by /api/voz).
 *
 * - One shared <audio> element: once a tap has unlocked it, later announcements
 *   can play on their own (iOS/Safari only allow that for an unlocked element).
 * - Long text is split into sentences: the first one starts sooner and the next
 *   is fetched while the current one plays.
 * - If the voice service can't be reached, the browser's own voice reads the rest.
 * - Under data saver the phone's own voice is used from the start (no audio downloads).
 */

let player: HTMLAudioElement | null = null;
let generation = 0;
let unlocked = false;

/** 10 ms of silence as a valid WAV: playing it during a tap unlocks the element. */
function silence(): string {
    const rate = 8000, samples = 80;
    const view = new DataView(new ArrayBuffer(44 + samples));
    const ascii = (offset: number, text: string) => { for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i)); };
    ascii(0, 'RIFF'); view.setUint32(4, 36 + samples, true); ascii(8, 'WAVE');
    ascii(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, rate, true); view.setUint32(28, rate, true); view.setUint16(32, 1, true); view.setUint16(34, 8, true);
    ascii(36, 'data'); view.setUint32(40, samples, true);
    for (let i = 0; i < samples; i++) view.setUint8(44 + i, 128);
    return URL.createObjectURL(new Blob([view.buffer], { type: 'audio/wav' }));
}

function audio(): HTMLAudioElement | null {
    if (typeof window === 'undefined') return null;
    if (!player) {
        player = new Audio();
        player.preload = 'auto';
    }
    return player;
}

function currentVoice(): string {
    const v = useAppStore.getState().settings.ttsVoice;
    return isKnownVoice(v) ? v : DEFAULT_TTS_VOICE;
}

/** Plain text for speech: no markdown, no list bullets, units spelled out. */
export function speakable(text: string): string {
    return text
        .replace(/\*\*(.+?)\*\*/g, '$1')
        .replace(/[*_`#>]/g, '')
        .replace(/^\s*[-•]\s+/gm, '')
        .replace(/^\s*\d+\.\s+/gm, '')
        .replace(/(\d)\s*mts?\b/gi, '$1 metros')
        .replace(/(\d)\s*kms?\b/gi, '$1 kilómetros')
        .replace(/(\d)\s*min\b/gi, '$1 minutos')
        .replace(/[→←↔]/g, ', ')
        .replace(/\s+/g, ' ')
        .trim();
}

/** Split into sentence groups under the server limit (first group kept short to start fast). */
function chunks(text: string): string[] {
    const sentences = text.match(/[^.!?¡¿]+[.!?]*|[¡¿][^.!?]+[.!?]*/g)?.map((s) => s.trim()).filter(Boolean) || [text];
    const out: string[] = [];
    let buf = '';
    for (const s of sentences) {
        const limit = out.length === 0 ? 160 : 420;
        if (buf && (buf + ' ' + s).length > limit) {
            out.push(buf);
            buf = s;
        } else {
            buf = buf ? `${buf} ${s}` : s;
        }
    }
    if (buf) out.push(buf);
    return out.flatMap((c) => (c.length <= TTS_MAX_CHARS ? [c] : c.match(new RegExp(`.{1,${TTS_MAX_CHARS}}(\\s|$)`, 'g')) || [c.slice(0, TTS_MAX_CHARS)]));
}

/** Download fully: the server only caches a phrase once its audio stream has been read to the end. */
function warm(url: string) {
    fetch(url).then((r) => (r.ok ? r.arrayBuffer() : null)).catch(() => undefined);
}

function voiceUrl(text: string, voice: string): string {
    return `/api/voz?${new URLSearchParams({ texto: text, voz: voice }).toString()}`;
}

/** Warm the server and HTTP caches so a known upcoming phrase plays instantly. */
export function prefetchSpeech(text: string) {
    const clean = speakable(text);
    if (!clean || isDataSaver()) return;
    const voice = currentVoice();
    for (const c of chunks(clean).slice(0, 2)) warm(voiceUrl(c, voice));
}

/** Call from a tap/click so later speech can autoplay (needed on iOS). */
export function unlockSpeech() {
    const el = audio();
    if (!el || unlocked) return;
    el.src = silence();
    el.play().then(() => { unlocked = true; }).catch(() => undefined);
}

function playUrl(el: HTMLAudioElement, url: string, gen: number): Promise<void> {
    return new Promise((resolve, reject) => {
        if (gen !== generation) return resolve();
        const cleanup = () => {
            el.removeEventListener('ended', onEnd);
            el.removeEventListener('error', onError);
        };
        const onEnd = () => { cleanup(); resolve(); };
        const onError = () => { cleanup(); reject(new Error('audio error')); };
        el.addEventListener('ended', onEnd);
        el.addEventListener('error', onError);
        el.src = url;
        el.play().catch((err) => { cleanup(); reject(err); });
    });
}

function browserUtterance(text: string): SpeechSynthesisUtterance {
    const synth = window.speechSynthesis;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'es-CO';
    const voices = synth.getVoices();
    const v = voices.find((x) => x.lang === 'es-CO') || voices.find((x) => x.lang === 'es-US' || x.lang === 'es-MX') || voices.find((x) => x.lang.startsWith('es'));
    if (v) u.voice = v;
    return u;
}

function browserSpeak(text: string) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(browserUtterance(text));
}

/** The phone's voice, resolving when it finishes (or is interrupted). */
function browserSpeakUntilDone(text: string): Promise<void> {
    return new Promise((resolve) => {
        const u = browserUtterance(text);
        u.onend = () => resolve();
        u.onerror = () => resolve();
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(u);
    });
}

/**
 * Speak `text` with the user's chosen voice. Interrupts anything already playing.
 * `neural` forces the downloaded voice even under data saver (voice previews).
 */
export async function speak(text: string, { neural = false }: { neural?: boolean } = {}): Promise<void> {
    const el = audio();
    const clean = speakable(text);
    if (!el || !clean) return;
    stopSpeaking();
    if (!neural && isDataSaver() && 'speechSynthesis' in window) return browserSpeakUntilDone(clean);
    const gen = generation;
    const voice = currentVoice();
    const parts = chunks(clean);

    for (let i = 0; i < parts.length; i++) {
        if (gen !== generation) return;
        if (parts[i + 1]) warm(voiceUrl(parts[i + 1], voice));
        try {
            await playUrl(el, voiceUrl(parts[i], voice), gen);
        } catch {
            // Offline, blocked autoplay or service down: let the browser read what's left
            if (gen === generation) browserSpeak(parts.slice(i).join(' '));
            return;
        }
    }
}

export function stopSpeaking() {
    generation++;
    if (player) {
        player.pause();
        player.removeAttribute('src');
        player.load();
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
}

export function canSpeak(): boolean {
    return typeof window !== 'undefined' && typeof Audio !== 'undefined';
}
