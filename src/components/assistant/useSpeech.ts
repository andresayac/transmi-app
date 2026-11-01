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

/** Plain text for speech: drop markdown marks and list bullets. */
function forSpeech(text: string) {
    return text
        .replace(/\*\*(.+?)\*\*/g, '$1')
        .replace(/^\s*[-*•]\s+/gm, '')
        .replace(/^\s*\d+\.\s+/gm, '')
        .replace(/\s+/g, ' ')
        .trim();
}

export function speak(text: string) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(forSpeech(text));
    const voices = synth.getVoices();
    const voice = voices.find((v) => v.lang === 'es-CO') || voices.find((v) => v.lang === 'es-US') || voices.find((v) => v.lang.startsWith('es'));
    if (voice) utterance.voice = voice;
    utterance.lang = voice?.lang || 'es-CO';
    utterance.rate = 1.03;
    synth.speak(utterance);
}

export function stopSpeaking() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
}

export function canSpeak() {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
}
