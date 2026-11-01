'use client';

import { KeyboardEvent, useEffect, useRef, useState } from 'react';
import { ArrowUp, Mic, Square } from 'lucide-react';
import { useSpeechRecognition } from './useSpeech';
import { cn } from '@/lib/utils';

interface ComposerProps {
    onSend: (text: string) => void;
    onStop: () => void;
    streaming: boolean;
    disabled?: boolean;
}

export default function Composer({ onSend, onStop, streaming, disabled }: ComposerProps) {
    const [value, setValue] = useState('');
    const textarea = useRef<HTMLTextAreaElement>(null);
    const speech = useSpeechRecognition((text) => {
        setValue('');
        onSend(text);
    });

    const shown = speech.listening && speech.interim ? speech.interim : value;

    useEffect(() => {
        const el = textarea.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
    }, [shown]);

    const submit = () => {
        const text = value.trim();
        if (!text || streaming || disabled) return;
        onSend(text);
        setValue('');
    };

    const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            submit();
        }
    };

    return (
        <div className="border-t border-border bg-background/95 px-3 pt-2.5 pb-[calc(env(safe-area-inset-bottom)+10px)] backdrop-blur-xl">
            {speech.error && <p className="px-2 pb-1.5 text-12 text-muted-foreground" role="status">{speech.error}</p>}
            <div className={cn('flex items-end gap-2 rounded-[22px] border border-border bg-secondary py-1.5 pl-4 pr-1.5 transition-colors focus-within:border-ring', speech.listening && 'border-foreground')}>
                <label htmlFor="assistant-input" className="sr-only">Mensaje para el asistente</label>
                <textarea
                    id="assistant-input"
                    ref={textarea}
                    rows={1}
                    value={shown}
                    onChange={(e) => setValue(e.target.value)}
                    onKeyDown={onKeyDown}
                    readOnly={speech.listening}
                    placeholder={speech.listening ? 'Te escucho…' : '¿A dónde quieres ir?'}
                    maxLength={2000}
                    className="max-h-[140px] min-h-[36px] flex-1 resize-none bg-transparent py-2 text-16 leading-snug text-foreground placeholder:text-muted-foreground focus:outline-none"
                />

                {speech.supported && !streaming && (
                    <button
                        type="button"
                        onClick={speech.listening ? speech.stop : speech.start}
                        disabled={disabled}
                        className={cn(
                            'relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition active:scale-90 disabled:opacity-40',
                            speech.listening ? 'bg-foreground text-background' : 'text-foreground hover:bg-accent',
                        )}
                        aria-label={speech.listening ? 'Dejar de escuchar' : 'Dictar por voz'}
                        aria-pressed={speech.listening}
                    >
                        {speech.listening && <span className="absolute inset-0 rounded-full bg-foreground/40 motion-safe:animate-ping" />}
                        <Mic className="relative h-[18px] w-[18px]" />
                    </button>
                )}

                {streaming ? (
                    <button
                        type="button"
                        onClick={onStop}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-foreground text-background transition active:scale-90"
                        aria-label="Detener respuesta"
                    >
                        <Square className="h-3.5 w-3.5" fill="currentColor" />
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={submit}
                        disabled={!value.trim() || disabled || speech.listening}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-foreground text-background transition active:scale-90 disabled:opacity-30"
                        aria-label="Enviar"
                    >
                        <ArrowUp className="h-[18px] w-[18px]" strokeWidth={2.5} />
                    </button>
                )}
            </div>
        </div>
    );
}
