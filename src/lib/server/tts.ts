import 'server-only';

import { EdgeTTS } from '@andresaya/edge-tts';

/**
 * Small LRU of synthesized audio. Trip announcements ("Bájate aquí: Calle 72")
 * and the voice preview repeat a lot, so most of them come back instantly.
 */
const MAX_ENTRIES = 200;
const MAX_BYTES = 20 * 1024 * 1024;
const cache = new Map<string, Uint8Array>();
let cachedBytes = 0;

export function cacheKey(text: string, voice: string, rate: number) {
    return `${voice}|${rate}|${text}`;
}

export function getCached(key: string): Uint8Array | null {
    const hit = cache.get(key);
    if (!hit) return null;
    // Refresh recency
    cache.delete(key);
    cache.set(key, hit);
    return hit;
}

export function putCached(key: string, audio: Uint8Array) {
    if (audio.byteLength === 0 || audio.byteLength > 2 * 1024 * 1024) return;
    if (cache.has(key)) return;
    cache.set(key, audio);
    cachedBytes += audio.byteLength;
    while (cache.size > MAX_ENTRIES || cachedBytes > MAX_BYTES) {
        const oldest = cache.keys().next().value as string;
        cachedBytes -= cache.get(oldest)?.byteLength || 0;
        cache.delete(oldest);
    }
}

type SynthesisOptions = Parameters<EdgeTTS['generate']>[2];

/**
 * The library declares the document as en-US. Multilingual voices follow the
 * document language, so declaring es-CO makes them read as Colombian Spanish.
 * (The service rejects an inner <lang> element; the root xml:lang is accepted.)
 */
class SpanishEdgeTTS extends EdgeTTS {
    protected buildSSML(text: string, voice: string, options: NonNullable<SynthesisOptions>): string {
        return super.buildSSML(text, voice, options).replace('xml:lang="en-US"', 'xml:lang="es-CO"');
    }
}

/** Stream MP3 chunks for `text` as they arrive from the speech service. */
export function synthesizeStream(text: string, voice: string, rate: number, signal?: AbortSignal): AsyncIterable<Uint8Array> {
    const tts = new SpanishEdgeTTS({ timeout: 15000 });
    return tts.synthesizeStream(text, voice, {
        rate: `${rate >= 0 ? '+' : ''}${rate}%`,
        signal,
    }) as AsyncIterable<Uint8Array>;
}
