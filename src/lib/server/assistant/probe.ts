import 'server-only';

import OpenAI from 'openai';
import { z } from 'zod/v4';
import { cached } from '@/lib/server/upstream';
import { configuredEndpoints, type AIEndpoint } from './providers';
import { clientFor, toFunctionTool } from './openaiCompatible';

export interface EndpointCheck {
    host: string;
    model: string;
    /** Model listed by GET /models (null when the server doesn't expose the list) */
    modelListed: boolean | null;
    /** The model answered a chat request */
    reachable: boolean;
    /** The model called a tool when asked to */
    toolCalls: boolean;
    latencyMs: number | null;
    error?: string;
}

const PING_TOOL = toFunctionTool({
    name: 'consultar_hora',
    description: 'Devuelve la hora actual en Bogotá.',
    inputSchema: z.object({ ciudad: z.string().describe('Nombre de la ciudad') }),
});

function describeError(err: unknown): string {
    if (err instanceof OpenAI.APIError) {
        if (err.status === 401 || err.status === 403) return 'La clave no es válida para este host (401/403).';
        if (err.status === 404) return 'El host no reconoce el modelo o la ruta (404). Revisa AI_MODEL y que AI_BASE_URL termine en /v1 (o la ruta que indique el proveedor).';
        if (err.status === 400) return `El servidor rechazó la solicitud (400): ${err.message}`;
        return `El servidor respondió ${err.status}: ${err.message}`;
    }
    return err instanceof Error ? err.message : 'Error desconocido';
}

async function check(endpoint: AIEndpoint): Promise<EndpointCheck> {
    const client = clientFor(endpoint);
    const result: EndpointCheck = { host: endpoint.label, model: endpoint.model, modelListed: null, reachable: false, toolCalls: false, latencyMs: null };

    try {
        const models = await client.models.list();
        result.modelListed = models.data.some((m) => m.id === endpoint.model);
    } catch {
        result.modelListed = null; // not every compatible server implements /models
    }

    const started = Date.now();
    try {
        const res = await client.chat.completions.create({
            model: endpoint.model,
            messages: [{ role: 'user', content: '¿Qué hora es en Bogotá? Usa la herramienta.' }],
            tools: [PING_TOOL],
            tool_choice: 'auto',
            ...(endpoint.reasoningEffort ? { reasoning_effort: endpoint.reasoningEffort as 'low' } : {}),
        });
        result.latencyMs = Date.now() - started;
        result.reachable = true;
        result.toolCalls = (res.choices[0]?.message?.tool_calls?.length ?? 0) > 0;
        if (!result.toolCalls) result.error = 'El modelo respondió pero no llamó la herramienta: elige un modelo con soporte de "tools" / function calling.';
    } catch (err) {
        result.error = describeError(err);
    }
    return result;
}

/** Check every configured endpoint (cached 5 min so it can't be used to burn tokens). */
export function probeEndpoints(): Promise<EndpointCheck[]> {
    const endpoints = configuredEndpoints();
    const key = `ai-probe:${endpoints.map((e) => `${e.baseURL}|${e.model}`).join(',')}`;
    return cached(key, 5 * 60 * 1000, () => Promise.all(endpoints.map(check)));
}

export function describeEndpoints() {
    return configuredEndpoints().map((e, i) => ({ role: i === 0 ? 'principal' : 'respaldo', host: e.label, model: e.model }));
}
