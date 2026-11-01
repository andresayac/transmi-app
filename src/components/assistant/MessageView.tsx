'use client';

import { AlertCircle, Check, Loader2, RotateCcw } from 'lucide-react';
import type { UiMessage } from './types';
import Markdown from './Markdown';
import AssistantCardView from './Cards';
import AssistantOrb from '@/components/brand/AssistantOrb';
import { cn } from '@/lib/utils';

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

    const streaming = message.status === 'streaming';
    const lastPart = message.parts[message.parts.length - 1];
    const waiting = streaming && (!lastPart || (lastPart.type === 'tool' && lastPart.status !== 'start'));

    return (
        <div className="flex gap-3" aria-live={isLast ? 'polite' : undefined}>
            <AssistantOrb size={26} icon={false} active={streaming} className="mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1 space-y-3">
                {message.parts.map((part, i) => {
                    if (part.type === 'text') {
                        const caret = streaming && i === message.parts.length - 1;
                        return (
                            <div key={i} className="relative text-[15px] leading-relaxed text-foreground/90">
                                <Markdown text={part.text} />
                                {caret && <span className="ml-0.5 inline-block h-4 w-[7px] translate-y-[3px] bg-foreground/70 motion-safe:animate-pulse" aria-hidden />}
                            </div>
                        );
                    }
                    if (part.type === 'tool') {
                        return (
                            <p key={part.id} className="flex items-center gap-2 text-[13px] text-muted-foreground">
                                {part.status === 'start' ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : part.status === 'done' ? (
                                    <Check className="h-3.5 w-3.5" />
                                ) : (
                                    <AlertCircle className="h-3.5 w-3.5" />
                                )}
                                <span className={cn(part.status === 'error' && 'line-through')}>{part.label}</span>
                            </p>
                        );
                    }
                    return <AssistantCardView key={i} card={part.card} />;
                })}

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
