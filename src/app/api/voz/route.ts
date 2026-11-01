import { NextResponse } from 'next/server';
import { cacheKey, getCached, putCached, synthesizeStream } from '@/lib/server/tts';
import { DEFAULT_TTS_VOICE, isKnownVoice, TTS_MAX_CHARS } from '@/lib/voices';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const audioHeaders = {
    'Content-Type': 'audio/mpeg',
    // Same text + voice + rate always gives the same audio
    'Cache-Control': 'public, max-age=604800, immutable',
};

// GET /api/voz?texto=…[&voz=en-US-AvaMultilingualNeural][&velocidad=0]
// Streams MP3 from Microsoft Edge's neural voices (relay: browsers other than Edge can't call the service directly).
export async function GET(request: Request) {
    const q = new URL(request.url).searchParams;
    const text = (q.get('texto') || '').replace(/\s+/g, ' ').trim();
    if (!text) return NextResponse.json({ error: 'Falta el texto' }, { status: 400 });
    if (text.length > TTS_MAX_CHARS) return NextResponse.json({ error: `El texto supera ${TTS_MAX_CHARS} caracteres` }, { status: 413 });

    const voiceParam = q.get('voz');
    const voice = isKnownVoice(voiceParam) ? voiceParam : DEFAULT_TTS_VOICE;
    const rate = Math.max(-30, Math.min(40, Math.round(Number(q.get('velocidad')) || 0)));
    const key = cacheKey(text, voice, rate);

    const cached = getCached(key);
    if (cached) return new Response(new Uint8Array(cached), { headers: { ...audioHeaders, 'Content-Length': String(cached.byteLength), 'X-Cache': 'HIT' } });

    // Wait for the first chunk so failures still get a proper status code
    const iterator = synthesizeStream(text, voice, rate, request.signal)[Symbol.asyncIterator]();
    let first: IteratorResult<Uint8Array>;
    try {
        first = await iterator.next();
    } catch (err) {
        console.error('[voz]', err instanceof Error ? err.message : err);
        return NextResponse.json({ error: 'El servicio de voz no respondió' }, { status: 502 });
    }
    if (first.done) return NextResponse.json({ error: 'El servicio de voz no devolvió audio' }, { status: 502 });

    const parts: Uint8Array[] = [first.value];
    const stream = new ReadableStream<Uint8Array>({
        start(controller) {
            controller.enqueue(first.value);
        },
        async pull(controller) {
            try {
                const { value, done } = await iterator.next();
                if (done) {
                    controller.close();
                    const total = parts.reduce((s, p) => s + p.byteLength, 0);
                    const audio = new Uint8Array(total);
                    let offset = 0;
                    for (const p of parts) { audio.set(p, offset); offset += p.byteLength; }
                    putCached(key, audio);
                    return;
                }
                parts.push(value);
                controller.enqueue(value);
            } catch (err) {
                controller.error(err);
            }
        },
        async cancel() {
            await iterator.return?.();
        },
    });

    return new Response(stream, { headers: { ...audioHeaders, 'X-Cache': 'MISS' } });
}
