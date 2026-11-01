import 'server-only';

import Anthropic from '@anthropic-ai/sdk';
import type { BetaMessageParam } from '@anthropic-ai/sdk/resources/beta/messages/messages';
import { SYSTEM_PROMPT, buildContextBlock } from './prompt';
import { createTools } from './tools';
import type { AssistantContext, AssistantEvent, ChatTurn } from '@/components/assistant/types';

const MODEL = process.env.ASSISTANT_MODEL || 'claude-opus-5-5';
type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';
const EFFORTS: Effort[] = ['low', 'medium', 'high', 'xhigh', 'max'];
// Chat latency matters more than depth here; raise with ASSISTANT_EFFORT if answers fall short.
const EFFORT: Effort = EFFORTS.includes(process.env.ASSISTANT_EFFORT as Effort) ? (process.env.ASSISTANT_EFFORT as Effort) : 'low';

export const MAX_TURNS = 20;

export function hasCredentials(): boolean {
    return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

/** Thrown when a tool_use was cut off by max_tokens: never run a truncated tool input. */
class TruncatedToolInput extends Error { }

/** Normalize client history into a valid, alternating API conversation that ends with the user. */
function toApiMessages(turns: ChatTurn[], context: AssistantContext | undefined): BetaMessageParam[] {
    const clean = turns
        .map((t) => ({ role: t.role, content: t.content.trim() }))
        .filter((t) => t.content.length > 0);

    const merged: ChatTurn[] = [];
    for (const t of clean) {
        const last = merged[merged.length - 1];
        if (last && last.role === t.role) last.content += `\n\n${t.content}`;
        else merged.push({ ...t });
    }
    let recent = merged.slice(-MAX_TURNS);
    while (recent.length && recent[0].role !== 'user') recent = recent.slice(1);
    if (!recent.length || recent[recent.length - 1].role !== 'user') throw new Error('La conversación debe terminar con un mensaje del usuario');

    const lastIdx = recent.length - 1;
    return recent.map((t, i) => ({
        role: t.role,
        content: i === lastIdx ? `${buildContextBlock(context)}\n\n${t.content}` : t.content,
    }));
}

interface RunOptions {
    turns: ChatTurn[];
    context?: AssistantContext;
    emit: (event: AssistantEvent) => void;
    signal: AbortSignal;
}

/**
 * Run one assistant turn with the SDK tool runner, streaming text deltas and
 * tool/card events through `emit`. Resolves when the model is done.
 */
export async function runAssistant({ turns, context = {}, emit, signal }: RunOptions): Promise<void> {
    const client = new Anthropic({ maxRetries: 1 });
    const tools = createTools(emit, context);

    let runner = client.beta.messages.toolRunner(
        {
            model: MODEL,
            max_tokens: 16000,
            system: SYSTEM_PROMPT,
            tools,
            messages: toApiMessages(turns, context),
            output_config: { effort: EFFORT },
            cache_control: { type: 'ephemeral' },
            betas: ['server-side-fallback-2026-07-01'],
            fallbacks: 'default',
            max_iterations: 8,
            stream: true,
        },
        { signal },
    );

    let emittedText = false;
    let needsSeparator = false;

    for (let attempt = 0; ; attempt++) {
        try {
            for await (const messageStream of runner) {
                let iterationText = false;
                for await (const event of messageStream) {
                    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta' && event.delta.text) {
                        if (!iterationText && needsSeparator) emit({ type: 'text', delta: '\n\n' });
                        iterationText = true;
                        emittedText = true;
                        emit({ type: 'text', delta: event.delta.text });
                    }
                }
                const message = await messageStream.finalMessage();
                attempt = 0; // the cap is on consecutive failures of one turn
                if (iterationText) needsSeparator = true;

                const hasToolUse = message.content.some((b) => b.type === 'tool_use');
                if (message.stop_reason === 'max_tokens' && hasToolUse) {
                    throw new TruncatedToolInput('tool input truncated by max_tokens');
                }
                if (message.stop_reason === 'refusal') {
                    emit({
                        type: 'error',
                        code: 'refusal',
                        message: 'No puedo ayudarte con eso. Pregúntame sobre rutas, estaciones o cómo moverte por Bogotá.',
                    });
                    return;
                }
            }
            break;
        } catch (err) {
            // Retry only tool inputs the SDK couldn't parse at all; API errors and truncation go up.
            if (err instanceof Anthropic.APIError || err instanceof TruncatedToolInput || attempt >= 2 || signal.aborted) throw err;
            runner = client.beta.messages.toolRunner({ ...runner.params, stream: true }, { signal });
        }
    }

    if (!emittedText) {
        emit({ type: 'text', delta: 'Listo. Te dejo la información arriba.' });
    }
}

export interface MappedError {
    status: number;
    code: 'not_configured' | 'rate_limited' | 'upstream';
    message: string;
}

export function mapAssistantError(err: unknown): MappedError {
    if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
        return { status: 503, code: 'not_configured', message: 'La clave de API de Anthropic no es válida o no tiene permisos. Revisa ANTHROPIC_API_KEY.' };
    }
    if (err instanceof Anthropic.RateLimitError) {
        return { status: 429, code: 'rate_limited', message: 'El asistente está recibiendo muchas consultas. Intenta de nuevo en un momento.' };
    }
    if (err instanceof Anthropic.APIError) {
        return { status: 502, code: 'upstream', message: 'El asistente no está disponible en este momento. Intenta de nuevo.' };
    }
    if (err instanceof TruncatedToolInput) {
        return { status: 502, code: 'upstream', message: 'La respuesta se cortó. Intenta con una pregunta más concreta.' };
    }
    return { status: 500, code: 'upstream', message: 'Algo salió mal al responder. Intenta de nuevo.' };
}
