'use client';

import { AlertCircle, Check, Loader2, RotateCcw } from 'lucide-react';
import type { AssistantPart, UiMessage } from './types';
import Markdown from './Markdown';
import AssistantCardView from './Cards';
import AssistantOrb from '@/components/brand/AssistantOrb';

/** Past-tense labels for finished steps (the stream sends present tense while running). */
const DONE_LABEL: Record<string, string> = {
    buscar_lugar: 'Lugar encontrado',
    planear_viaje: 'Viaje planeado',
    buscar_rutas: 'Rutas encontradas',
    detalle_ruta: 'Ruta consultada',
    llegadas_estacion: 'Llegadas en vivo',
    buses_en_vivo: 'Buses ubicados',
    estaciones_cercanas: 'Estaciones cercanas',
    puntos_recarga_cercanos: 'Puntos encontrados',
    clima: 'Clima revisado',
    tarifa: 'Tarifa consultada',
};

const FAILED_LABEL = 'No se pudo completar';

interface MessageViewProps {
    message: UiMessage;
    isLast: boolean;
    onRetry: () => void;
}

export default function MessageView({ message, isLast, onRetry }: MessageViewProps) {
    if (message.role === 'user') {
        return (
            <div className="flex justify-end">
                <p className="max-w-[85%] whitespace-pre-wrap rounded-[20px] rounded-br-md bg-foreground px-4 py-2.5 text-[15px] leading-snug text-background">
                    {message.content}
                </p>
            </div>
        );
    }

    // The page shows its own setup notice; an empty reply bubble would only add noise
    if (message.error?.code === 'not_configured' && message.parts.length === 0) return null;

    const streaming = message.status === 'streaming';
    const lastPart = message.parts[message.parts.length - 1];
    const waiting = streaming && (!lastPart || (lastPart.type === 'tool' && lastPart.status !== 'start'));

    // Read order: what the assistant did (one line), what it says, then the cards it produced
    const tools = message.parts.filter((p): p is Extract<AssistantPart, { type: 'tool' }> => p.type === 'tool');
    const texts = message.parts.filter((p): p is Extract<AssistantPart, { type: 'text' }> => p.type === 'text');
    const cards = message.parts.filter((p): p is Extract<AssistantPart, { type: 'card' }> => p.type === 'card');
    const running = tools.filter((t) => t.status === 'start');
    const done = tools.filter((t) => t.status === 'done');
    const failed = tools.filter((t) => t.status === 'error');
    const doneLabels = [...new Set(done.map((t) => DONE_LABEL[t.name] || t.label.replace(/…$/, '')))];

    return (
        <div className="flex gap-3" aria-live={isLast ? 'polite' : undefined}>
            <AssistantOrb size={26} icon={false} active={streaming} className="mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1 space-y-3">
                {tools.length > 0 && (
                    <div className="space-y-1 text-[13px] text-muted-foreground">
                        {doneLabels.length > 0 && (
                            <p className="flex items-start gap-2">
                                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                <span>{doneLabels.join(' · ')}</span>
                            </p>
                        )}
                        {running.map((t) => (
                            <p key={t.id} className="flex items-center gap-2 text-foreground/80">
                                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                                <span>{t.label}</span>
                            </p>
                        ))}
                        {failed.map((t) => (
                            <p key={t.id} className="flex items-center gap-2">
                                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                                <span>{FAILED_LABEL}: {(DONE_LABEL[t.name] || t.label).replace(/…$/, '').toLowerCase()}</span>
                            </p>
                        ))}
                    </div>
                )}

                {texts.map((part, i) => {
                    const caret = streaming && part === lastPart;
                    return (
                        <div key={`t${i}`} className="relative text-[15px] leading-relaxed text-foreground/90">
                            <Markdown text={part.text} />
                            {caret && <span className="ml-0.5 inline-block h-4 w-[7px] translate-y-[3px] bg-foreground/70 motion-safe:animate-pulse" aria-hidden />}
                        </div>
                    );
                })}

                {cards.map((part, i) => <AssistantCardView key={`c${i}`} card={part.card} />)}

                {waiting && (
                    <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Pensando…
                    </p>
                )}

                {message.status === 'error' && message.error && message.error.code !== 'not_configured' && (
                    <div className="flex items-center gap-3 rounded-xl border border-border bg-secondary px-3.5 py-2.5 text-[13px]">
                        <AlertCircle className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="flex-1">{message.error.message}</span>
                        {isLast && message.error.code !== 'refusal' && (
                            <button onClick={onRetry} className="inline-flex shrink-0 items-center gap-1 font-semibold hover:underline">
                                <RotateCcw className="h-3.5 w-3.5" /> Reintentar
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
