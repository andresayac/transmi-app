import 'server-only';

import OpenAI from 'openai';
import { buildContextBlock } from './prompt';
import { createTools } from './tools';
import { configuredEndpoints } from './providers';
import { runOpenAICompatible, TruncatedOutput } from './openaiCompatible';
import { looksLikeCode, OUT_OF_SCOPE_REPLY, OutOfScopeOutput } from './scope';
import type { AssistantContext, AssistantEvent, ChatTurn } from '@/components/assistant/types';

export const MAX_TURNS = 20;

export function hasCredentials(): boolean {
    return configuredEndpoints().length > 0;
}

/** Normalize client history into an alternating conversation that ends with the user (context prepended). */
function normalizeTurns(turns: ChatTurn[], context: AssistantContext | undefined): ChatTurn[] {
    const merged: ChatTurn[] = [];
    for (const t of turns) {
        const content = t.content.trim();
        if (!content) continue;
        const last = merged[merged.length - 1];
        if (last && last.role === t.role) last.content += `\n\n${content}`;
        else merged.push({ role: t.role, content });
    }
    let recent = merged.slice(-MAX_TURNS);
    while (recent.length && recent[0].role !== 'user') recent = recent.slice(1);
    if (!recent.length || recent[recent.length - 1].role !== 'user') throw new Error('La conversación debe terminar con un mensaje del usuario');

    const lastIdx = recent.length - 1;
    return recent.map((t, i) => (i === lastIdx ? { ...t, content: `${buildContextBlock(context)}\n\n${t.content}` } : t));
}

interface RunOptions {
    turns: ChatTurn[];
    context?: AssistantContext;
    emit: (event: AssistantEvent) => void;
    signal: AbortSignal;
}

/**
 * Run one assistant turn on the configured endpoint. If it fails before anything
 * reached the user (rate limit, outage, bad key) and AI_FALLBACK_* is set, the
 * fallback endpoint answers instead.
 */
export async function runAssistant({ turns, context = {}, emit, signal }: RunOptions): Promise<void> {
    const endpoints = configuredEndpoints();
    const normalized = normalizeTurns(turns, context);
    let lastError: unknown = new Error('No hay un endpoint de IA configurado');

    for (const endpoint of endpoints) {
        let emitted = false;
        let text = '';
        const guardedEmit = (event: AssistantEvent) => {
            if (event.type === 'text') {
                text += event.delta;
                // Off-topic output (e.g. code) stops the model; the reply is replaced below
                if (looksLikeCode(text)) throw new OutOfScopeOutput();
            }
            emitted = true;
            emit(event);
        };
        try {
            const { emittedText } = await runOpenAICompatible({
                endpoint,
                turns: normalized,
                tools: createTools(guardedEmit, context),
                emit: guardedEmit,
                signal,
            });
            if (!emittedText) emit({ type: 'text', delta: 'Listo, aquí tienes la información.' });
            return;
        } catch (err) {
            if (err instanceof OutOfScopeOutput) {
                console.warn('[asistente] respuesta fuera de tema reemplazada');
                emit({ type: 'replace', text: OUT_OF_SCOPE_REPLY });
                return;
            }
            lastError = err;
            if (emitted || signal.aborted) throw err;
            console.warn(`[asistente] ${endpoint.label} (${endpoint.model}) falló: ${err instanceof Error ? err.message : err}`);
        }
    }
    throw lastError;
}

export interface MappedError {
    status: number;
    code: 'not_configured' | 'rate_limited' | 'upstream';
    message: string;
}

export function mapAssistantError(err: unknown): MappedError {
    const status = err instanceof OpenAI.APIError ? err.status : undefined;
    if (status === 401 || status === 403) {
        return { status: 503, code: 'not_configured', message: 'La clave del asistente no es válida o no tiene permisos. Revisa AI_API_KEY.' };
    }
    if (status === 404) {
        return { status: 502, code: 'upstream', message: 'El modelo configurado no existe en ese host. Revisa AI_MODEL y AI_BASE_URL.' };
    }
    if (status === 429) {
        return { status: 429, code: 'rate_limited', message: 'El asistente está recibiendo muchas consultas. Intenta de nuevo en un momento.' };
    }
    if (status !== undefined) {
        return { status: 502, code: 'upstream', message: 'El asistente no está disponible en este momento. Intenta de nuevo.' };
    }
    if (err instanceof TruncatedOutput) {
        return { status: 502, code: 'upstream', message: 'La respuesta se cortó. Intenta con una pregunta más concreta.' };
    }
    return { status: 500, code: 'upstream', message: 'Algo salió mal al responder. Intenta de nuevo.' };
}
