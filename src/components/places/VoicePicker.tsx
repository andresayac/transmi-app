'use client';

import { useEffect, useState } from 'react';
import { Check, Loader2, Play, Square } from 'lucide-react';
import { speak, stopSpeaking, unlockSpeech } from '@/lib/speech';
import { DEFAULT_TTS_VOICE, isKnownVoice, TTS_VOICES } from '@/lib/voices';
import { useAppStore } from '@/stores/app';
import { useDataSaver } from '@/lib/dataSaver';
import { cn } from '@/lib/utils';

const SAMPLE = (name: string) => `Hola, soy ${name}. La B13 llega en cuatro minutos. Prepárate: te bajas en la próxima parada, Calle 72.`;

/** Choose the neural voice for announcements and read-aloud, with a preview for each. */
export default function VoicePicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
    const selected = isKnownVoice(value) ? value : DEFAULT_TTS_VOICE;
    const [playing, setPlaying] = useState<string | null>(null);
    const [loading, setLoading] = useState<string | null>(null);
    const saving = useDataSaver();

    useEffect(() => () => stopSpeaking(), []);

    const preview = async (id: string, name: string) => {
        if (playing === id || loading === id) {
            stopSpeaking();
            setPlaying(null);
            setLoading(null);
            return;
        }
        unlockSpeech();
        onChange(id);
        // speak() reads the voice from the store: make sure it sees this one
        useAppStore.getState().updateSettings({ ttsVoice: id });
        setLoading(id);
        setPlaying(id);
        const done = speak(SAMPLE(name), { neural: true });
        // The first sentence starts after the audio request returns
        setTimeout(() => setLoading((l) => (l === id ? null : l)), 900);
        await done;
        setPlaying((p) => (p === id ? null : p));
        setLoading((l) => (l === id ? null : l));
    };

    return (
        <div className="py-3">
            <span className="block text-[15px] font-medium">Voz</span>
            <span className="block text-[13px] text-muted-foreground mb-2">
                {saving
                    ? 'Con el ahorro de datos, los avisos usan la voz del teléfono. Escuchar una muestra sí descarga el audio.'
                    : 'Voces neuronales multilingües: hablan español con naturalidad'}
            </span>
            <div role="radiogroup" aria-label="Voz de los avisos" className="grid grid-cols-2 gap-2">
                {TTS_VOICES.map((v) => {
                    const active = selected === v.id;
                    const isPlaying = playing === v.id;
                    return (
                        <div
                            key={v.id}
                            className={cn('relative flex items-center gap-2 rounded-xl border p-2.5 pr-2 transition', active ? 'border-foreground' : 'border-border')}
                        >
                            <button
                                role="radio"
                                aria-checked={active}
                                onClick={() => onChange(v.id)}
                                className="flex-1 min-w-0 text-left"
                            >
                                <span className="flex items-center gap-1.5">
                                    <span className="font-signage text-[19px] font-bold leading-none">{v.name}</span>
                                    {active && <Check className="w-3.5 h-3.5" />}
                                </span>
                                <span className="block text-[12px] text-muted-foreground truncate mt-0.5">{v.gender} · {v.style}</span>
                            </button>
                            <button
                                onClick={() => preview(v.id, v.name)}
                                className={cn('w-9 h-9 shrink-0 rounded-full flex items-center justify-center transition active:scale-90', isPlaying ? 'bg-foreground text-background' : 'bg-secondary')}
                                aria-label={isPlaying ? `Detener muestra de ${v.name}` : `Escuchar a ${v.name}`}
                            >
                                {loading === v.id ? <Loader2 className="w-4 h-4 animate-spin" /> : isPlaying ? <Square className="w-3.5 h-3.5 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
