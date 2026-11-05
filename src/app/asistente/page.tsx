'use client';

import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    Briefcase,
    ChevronLeft,
    Clock,
    CloudRain,
    CreditCard,
    House,
    KeyRound,
    Navigation,
    Route,
    SquarePen,
    Volume2,
    VolumeX,
} from 'lucide-react';
import AssistantOrb from '@/components/brand/AssistantOrb';
import SystemStripe from '@/components/brand/SystemStripe';
import Composer from '@/components/assistant/Composer';
import MessageView from '@/components/assistant/MessageView';
import { useAssistantChat } from '@/components/assistant/useAssistantChat';
import { canSpeak, speak, stopSpeaking, unlockSpeech, useBrowserSupport } from '@/components/assistant/useSpeech';
import type { AssistantContext } from '@/components/assistant/types';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useAppStore, useHydrated } from '@/stores/app';

const VOICE_KEY = 'transmi-assistant-voice';
const voiceListeners = new Set<() => void>();
const subscribeVoice = (cb: () => void) => {
    voiceListeners.add(cb);
    return () => { voiceListeners.delete(cb); };
};
const readVoice = () => {
    try { return localStorage.getItem(VOICE_KEY) === '1'; } catch { return false; }
};
const writeVoice = (on: boolean) => {
    try { localStorage.setItem(VOICE_KEY, on ? '1' : '0'); } catch { /* storage blocked */ }
    voiceListeners.forEach((l) => l());
};

const SUGGESTIONS = [
    { icon: Navigation, text: '¿Cómo llego al Movistar Arena?' },
    { icon: Clock, text: '¿Cuándo pasa el próximo bus en la estación Calle 72?' },
    { icon: CreditCard, text: '¿Dónde recargo mi TuLlave cerca de aquí?' },
    { icon: CloudRain, text: '¿Va a llover en la próxima hora?' },
    { icon: Route, text: '¿Qué horario tiene la K23?' },
];

export default function AssistantPage() {
    const router = useRouter();
    const hydrated = useHydrated();
    const home = useAppStore((s) => s.home);
    const work = useAppStore((s) => s.work);
    const { latitude, longitude } = useGeolocation();

    const getContext = useCallback((): AssistantContext => ({
        ...(latitude !== null && longitude !== null ? { lat: latitude, lng: longitude } : {}),
        home: hydrated && home ? { name: home.name, detail: home.detail, lat: home.lat, lng: home.lng } : null,
        work: hydrated && work ? { name: work.name, detail: work.detail, lat: work.lat, lng: work.lng } : null,
    }), [latitude, longitude, hydrated, home, work]);

    const { messages, streaming, notConfigured, send, retry, stop, reset } = useAssistantChat(getContext);

    // Read replies aloud (per-device preference)
    const voiceOut = useSyncExternalStore(subscribeVoice, readVoice, () => false);
    const voiceAvailable = useBrowserSupport(canSpeak);
    useEffect(() => () => stopSpeaking(), []);
    const toggleVoice = () => {
        const next = !voiceOut;
        if (next) unlockSpeech();
        else stopSpeaking();
        writeVoice(next);
    };

    const spoken = useRef<string | null>(null);
    useEffect(() => {
        const last = messages[messages.length - 1];
        if (!voiceOut || !last || last.role !== 'assistant' || last.status !== 'done' || spoken.current === last.id) return;
        spoken.current = last.id;
        if (last.content.trim()) speak(last.content);
    }, [messages, voiceOut]);

    // Keep the newest content in view while it streams in
    const scroller = useRef<HTMLDivElement>(null);
    const pinned = useRef(true);
    const onScroll = () => {
        const el = scroller.current;
        if (el) pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    };
    useEffect(() => {
        const el = scroller.current;
        const last = messages[messages.length - 1];
        if (el && (pinned.current || last?.role === 'user')) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    }, [messages]);

    const handleSend = (text: string) => {
        pinned.current = true;
        stopSpeaking();
        // A tap: lets the reply be read aloud when it arrives (iOS autoplay rules)
        if (voiceOut) unlockSpeech();
        send(text);
    };

    const newConversation = () => {
        stopSpeaking();
        spoken.current = null;
        reset();
    };

    const goBack = () => {
        if (window.history.length > 1) router.back();
        else router.push('/');
    };

    const empty = messages.length === 0;

    return (
        <div className="flex h-dvh flex-col bg-background">
            <header className="shrink-0 bg-background/90 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
                <div className="flex h-14 items-center gap-1 px-2 lg:mx-auto lg:h-20 lg:max-w-3xl lg:px-6">
                    <button onClick={goBack} className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-accent active:scale-90 lg:hidden" aria-label="Volver">
                        <ChevronLeft className="h-5 w-5" />
                    </button>
                    <AssistantOrb size={28} icon={false} active={streaming} className="ml-1" />
                    <h1 className="ml-2 flex-1 font-signage text-22 font-bold leading-none lg:text-34">Asistente</h1>
                    {voiceAvailable && (
                        <button
                            onClick={toggleVoice}
                            className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-accent active:scale-90"
                            aria-label={voiceOut ? 'Dejar de leer las respuestas en voz alta' : 'Leer las respuestas en voz alta'}
                            aria-pressed={voiceOut}
                            title={voiceOut ? 'Lectura en voz alta activada' : 'Lectura en voz alta desactivada'}
                        >
                            {voiceOut ? <Volume2 className="h-[18px] w-[18px]" /> : <VolumeX className="h-[18px] w-[18px] text-muted-foreground" />}
                        </button>
                    )}
                    {!empty && (
                        <button onClick={newConversation} className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-accent active:scale-90" aria-label="Nueva conversación" title="Nueva conversación">
                            <SquarePen className="h-[18px] w-[18px]" />
                        </button>
                    )}
                </div>
                <SystemStripe className="lg:hidden" />
            </header>

            <div ref={scroller} onScroll={onScroll} className="flex-1 overflow-y-auto overscroll-contain">
                {notConfigured && (
                    <div className="mx-4 mt-4 flex gap-3 rounded-2xl border border-border bg-secondary p-4 lg:mx-auto lg:max-w-3xl" role="alert">
                        <KeyRound className="mt-0.5 h-5 w-5 shrink-0" />
                        <div className="text-14 leading-snug">
                            <p className="font-semibold">El asistente aún no está configurado</p>
                            <p className="mt-1 text-muted-foreground">
                                Conecta cualquier API compatible con el estándar de chat completions (Groq, MiMo, OpenRouter, Ollama…): define <code className="rounded bg-background px-1 py-0.5 text-13">AI_BASE_URL</code>, <code className="rounded bg-background px-1 py-0.5 text-13">AI_API_KEY</code> y <code className="rounded bg-background px-1 py-0.5 text-13">AI_MODEL</code> en <code className="rounded bg-background px-1 py-0.5 text-13">.env</code> y reinicia el servidor.
                            </p>
                        </div>
                    </div>
                )}

                {empty ? (
                    <div className="flex min-h-full flex-col px-5 pb-6 pt-10 lg:mx-auto lg:max-w-3xl lg:px-6 lg:pt-16">
                        <AssistantOrb size={88} breathe className="self-start" />
                        <h2 className="mt-6 font-signage text-34 font-bold leading-[1.05]">Pregúntame cómo moverte por Bogotá</h2>
                        <p className="mt-2 max-w-[34ch] text-15 text-muted-foreground">
                            Consulto rutas, llegadas en vivo, el planeador y el clima para responderte.
                        </p>

                        <div className="mt-8 space-y-2 lg:grid lg:grid-cols-2 lg:gap-2 lg:space-y-0">
                            {hydrated && home && (
                                <SuggestionButton icon={House} text="¿Cómo llego a casa desde aquí?" onClick={handleSend} />
                            )}
                            {hydrated && work && (
                                <SuggestionButton icon={Briefcase} text="¿Cómo llego al trabajo desde aquí?" onClick={handleSend} />
                            )}
                            {SUGGESTIONS.map((s) => (
                                <SuggestionButton key={s.text} icon={s.icon} text={s.text} onClick={handleSend} />
                            ))}
                        </div>

                        <Link href="/conectar" className="mt-auto self-start pt-8 text-13 text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
                            ¿Usas Claude o ChatGPT? Conéctales TransMi y pregunta desde allá
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-6 px-4 py-5 lg:mx-auto lg:max-w-3xl lg:px-6">
                        {messages.map((m, i) => (
                            <MessageView key={m.id} message={m} isLast={i === messages.length - 1} onRetry={retry} />
                        ))}
                    </div>
                )}
            </div>

            <Composer onSend={handleSend} onStop={stop} streaming={streaming} />
        </div>
    );
}

function SuggestionButton({ icon: Icon, text, onClick }: { icon: typeof House; text: string; onClick: (text: string) => void }) {
    return (
        <button
            type="button"
            onClick={() => onClick(text)}
            className="flex w-full items-center gap-3 rounded-2xl border border-border px-4 py-3 text-left text-15 transition hover:bg-accent active:scale-[0.99]"
        >
            <Icon className="h-[18px] w-[18px] shrink-0 text-muted-foreground" />
            <span>{text}</span>
        </button>
    );
}
