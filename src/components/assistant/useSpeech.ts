'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

const noopSubscribe = () => () => { };

/** Browser capability that never changes after load; false during SSR. */
export function useBrowserSupport(check: () => boolean): boolean {
    return useSyncExternalStore(noopSubscribe, check, () => false);
}

// Minimal typings: the Web Speech API isn't in every TS DOM lib.
interface RecognitionResult {
    isFinal: boolean;
    0: { transcript: string };
}
interface RecognitionEvent {
    resultIndex: number;
    results: ArrayLike<RecognitionResult>;
}
interface Recognition {
    lang: string;
    interimResults: boolean;
    continuous: boolean;
    maxAlternatives: number;
    start(): void;
    stop(): void;
    abort(): void;
    onresult: ((e: RecognitionEvent) => void) | null;
    onerror: ((e: { error: string }) => void) | null;
    onend: (() => void) | null;
}
type RecognitionCtor = new () => Recognition;

function getRecognitionCtor(): RecognitionCtor | null {
    if (typeof window === 'undefined') return null;
    const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
    return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

const hasRecognition = () => getRecognitionCtor() !== null;

/**
 * Voice dictation in Colombian Spanish. `onFinal` receives the full transcript
 * when the user stops talking.
 */
export function useSpeechRecognition(onFinal: (text: string) => void) {
    const supported = useBrowserSupport(hasRecognition);
    const [listening, setListening] = useState(false);
    const [interim, setInterim] = useState('');
    const [error, setError] = useState<string | null>(null);
    const recognition = useRef<Recognition | null>(null);
    const finalText = useRef('');
    const onFinalRef = useRef(onFinal);

    useEffect(() => {
        onFinalRef.current = onFinal;
    }, [onFinal]);

    useEffect(() => () => recognition.current?.abort(), []);

    const start = useCallback(() => {
        const Ctor = getRecognitionCtor();
        if (!Ctor) return;
        recognition.current?.abort();
        const rec = new Ctor();
        rec.lang = 'es-CO';
        rec.interimResults = true;
        rec.continuous = false;
        rec.maxAlternatives = 1;
        finalText.current = '';
        setInterim('');
        setError(null);

        rec.onresult = (e) => {
            let interimText = '';
            for (let i = e.resultIndex; i < e.results.length; i++) {
                const r = e.results[i];
                if (r.isFinal) finalText.current += r[0].transcript;
                else interimText += r[0].transcript;
            }
            setInterim((finalText.current + interimText).trim());
        };
        rec.onerror = (e) => {
            if (e.error === 'not-allowed' || e.error === 'service-not-allowed') setError('Permite el micrófono para dictar.');
            else if (e.error === 'no-speech') setError('No te escuché. Intenta de nuevo.');
            else if (e.error !== 'aborted') setError('No se pudo usar el micrófono.');
        };
        rec.onend = () => {
            setListening(false);
            const text = finalText.current.trim();
            setInterim('');
            if (text) onFinalRef.current(text);
        };

        recognition.current = rec;
        try {
            rec.start();
            setListening(true);
        } catch {
            setError('No se pudo usar el micrófono.');
        }
    }, []);

    const stop = useCallback(() => recognition.current?.stop(), []);

    return { supported, listening, interim, error, start, stop };
}

// Speech output lives in lib/speech (Edge neural voices via /api/voz); re-exported for the chat UI.
export { speak, stopSpeaking, canSpeak, unlockSpeech } from '@/lib/speech';
