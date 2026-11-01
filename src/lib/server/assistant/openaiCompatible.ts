import 'server-only';

import OpenAI from 'openai';
import type { ChatCompletionCreateParamsStreaming, ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions';
import { z } from 'zod/v4';
import { SYSTEM_PROMPT } from './prompt';
import type { ToolDef } from './tools';
import type { AIEndpoint } from './providers';
import type { AssistantEvent } from '@/components/assistant/types';

const MAX_STEPS = 8;

export class TruncatedOutput extends Error { }

export function clientFor(endpoint: AIEndpoint): OpenAI {
    return new OpenAI({ apiKey: endpoint.apiKey, baseURL: endpoint.baseURL, maxRetries: 1, timeout: 60000 });
}

/** Zod → JSON Schema for the `tools` array (without the $schema marker some servers reject). */
export function toFunctionTool(def: Pick<ToolDef, 'name' | 'description' | 'inputSchema'>): ChatCompletionTool {
    const schema = z.toJSONSchema(def.inputSchema) as Record<string, unknown>;
    delete schema.$schema;
    return { type: 'function', function: { name: def.name, description: def.description, parameters: schema } };
}

/** Standard optional parameters, only when configured. */
function optionalParams(endpoint: AIEndpoint): Partial<ChatCompletionCreateParamsStreaming> {
    return {
        ...(endpoint.maxTokens ? { max_tokens: endpoint.maxTokens } : {}),
        ...(endpoint.reasoningEffort ? { reasoning_effort: endpoint.reasoningEffort as ChatCompletionCreateParamsStreaming['reasoning_effort'] } : {}),
    };
}

interface PendingCall {
    id: string;
    name: string;
    args: string;
}

interface RunOptions {
    endpoint: AIEndpoint;
    turns: { role: 'user' | 'assistant'; content: string }[];
    tools: ToolDef[];
    emit: (event: AssistantEvent) => void;
    signal: AbortSignal;
}

/**
 * Tool-use loop over the standard Chat Completions API: stream text, collect
 * tool calls from the deltas, validate inputs with Zod, run the tools, and loop
 * until the model answers.
 */
export async function runOpenAICompatible({ endpoint, turns, tools, emit, signal }: RunOptions): Promise<{ emittedText: boolean }> {
    const client = clientFor(endpoint);
    const byName = new Map(tools.map((t) => [t.name, t]));
    const toolSpecs = tools.map(toFunctionTool);
    const messages: ChatCompletionMessageParam[] = [{ role: 'system', content: SYSTEM_PROMPT }, ...turns];

    let emittedText = false;
    let needsSeparator = false;

    const streamText = (text: string, firstOfStep: boolean) => {
        if (firstOfStep && needsSeparator) emit({ type: 'text', delta: '\n\n' });
        emittedText = true;
        emit({ type: 'text', delta: text });
    };

    for (let step = 0; step < MAX_STEPS; step++) {
        const stream = await client.chat.completions.create(
            { model: endpoint.model, messages, tools: toolSpecs, tool_choice: 'auto', stream: true, ...optionalParams(endpoint) },
            { signal },
        );

        let content = '';
        let reasoning = '';
        let finish: string | null = null;
        const calls: PendingCall[] = [];

        for await (const chunk of stream) {
            const choice = chunk.choices?.[0];
            if (!choice) continue;
            // Some servers stream the model's reasoning separately (non-standard field)
            const delta = choice.delta as typeof choice.delta & { reasoning_content?: string | null };
            if (delta.reasoning_content) reasoning += delta.reasoning_content;

            if (delta.content) {
                streamText(delta.content, content === '');
                content += delta.content;
            }

            for (const tc of delta.tool_calls || []) {
                const index = tc.index ?? calls.length;
                const slot = (calls[index] ||= { id: '', name: '', args: '' });
                if (tc.id) slot.id = tc.id;
                if (tc.function?.name) slot.name += tc.function.name;
                if (tc.function?.arguments) slot.args += tc.function.arguments;
            }

            if (choice.finish_reason) finish = choice.finish_reason;
        }

        if (content) needsSeparator = true;
        const pending = calls.filter(Boolean).map((c, i) => ({ ...c, id: c.id || `call_${step}_${i}` }));

        if (pending.length === 0) {
            if (finish === 'content_filter') {
                emit({ type: 'error', code: 'refusal', message: 'No puedo ayudarte con eso. Pregúntame sobre rutas, estaciones o cómo moverte por Bogotá.' });
            }
            return { emittedText };
        }

        // A tool call cut off by the token limit can still parse as valid JSON: don't run it
        if (finish === 'length') throw new TruncatedOutput('tool call truncated by max tokens');

        messages.push({
            role: 'assistant',
            content: content || null,
            tool_calls: pending.map((c) => ({ id: c.id, type: 'function' as const, function: { name: c.name, arguments: c.args || '{}' } })),
            // Servers that stream reasoning_content expect it back on tool-call turns (thinking mode)
            ...(reasoning ? { reasoning_content: reasoning } : {}),
        } as ChatCompletionMessageParam);

        const results = await Promise.all(
            pending.map(async (call) => {
                const def = byName.get(call.name);
                if (!def) return { id: call.id, content: `La herramienta "${call.name}" no existe. Usa solo las herramientas disponibles.` };
                let raw: unknown;
                try {
                    raw = call.args.trim() ? JSON.parse(call.args) : {};
                } catch {
                    return { id: call.id, content: 'Los argumentos no son JSON válido. Vuelve a llamar la herramienta con JSON correcto.' };
                }
                const parsed = def.inputSchema.safeParse(raw);
                if (!parsed.success) {
                    return { id: call.id, content: `Argumentos inválidos: ${z.prettifyError(parsed.error)}. Corrige y vuelve a intentar.` };
                }
                try {
                    return { id: call.id, content: await def.run(parsed.data, call.id) };
                } catch (err) {
                    return { id: call.id, content: err instanceof Error ? err.message : 'La consulta falló.' };
                }
            }),
        );

        for (const r of results) messages.push({ role: 'tool', tool_call_id: r.id, content: r.content });
    }

    // Ran out of steps: ask for a final answer without tools so the user isn't left hanging
    const final = await client.chat.completions.create(
        { model: endpoint.model, messages, stream: true, ...optionalParams(endpoint) },
        { signal },
    );
    let first = true;
    for await (const chunk of final) {
        const text = chunk.choices?.[0]?.delta?.content;
        if (text) {
            streamText(text, first);
            first = false;
        }
    }
    return { emittedText };
}
