import 'server-only';

/**
 * Any OpenAI-compatible Chat Completions endpoint: Groq, Xiaomi MiMo, OpenAI,
 * OpenRouter, DeepSeek, Together, a local Ollama/LM Studio/vLLM… Configure it with
 * a host, a key and a model; nothing provider-specific is hardcoded.
 *
 *   AI_BASE_URL   e.g. https://api.groq.com/openai/v1
 *   AI_API_KEY
 *   AI_MODEL
 *
 * Optional second endpoint, used when the first fails before answering:
 *   AI_FALLBACK_BASE_URL, AI_FALLBACK_API_KEY, AI_FALLBACK_MODEL
 *
 * Optional standard parameters (sent only when set):
 *   AI_REASONING_EFFORT  low | medium | high  (reasoning models)
 *   AI_MAX_TOKENS        output token limit
 */
export interface AIEndpoint {
    /** Short name for logs and the status endpoint (the host) */
    label: string;
    baseURL: string;
    apiKey: string;
    model: string;
    reasoningEffort?: string;
    maxTokens?: number;
}

const env = (name: string) => (process.env[name] || '').trim();

function hostOf(url: string): string {
    try {
        return new URL(url).host;
    } catch {
        return url;
    }
}

function endpoint(prefix: 'AI' | 'AI_FALLBACK'): AIEndpoint | null {
    const baseURL = env(`${prefix}_BASE_URL`).replace(/\/+$/, '');
    const model = env(`${prefix}_MODEL`);
    // Local servers (Ollama, LM Studio) don't need a key
    const apiKey = env(`${prefix}_API_KEY`) || 'no-key';
    if (!baseURL || !model) return null;
    const maxTokens = Number(env('AI_MAX_TOKENS'));
    return {
        label: hostOf(baseURL),
        baseURL,
        apiKey,
        model,
        reasoningEffort: env('AI_REASONING_EFFORT') || undefined,
        maxTokens: Number.isFinite(maxTokens) && maxTokens > 0 ? maxTokens : undefined,
    };
}

/** Configured endpoints in the order they are tried. */
export function configuredEndpoints(): AIEndpoint[] {
    return [endpoint('AI'), endpoint('AI_FALLBACK')].filter((e): e is AIEndpoint => e !== null);
}
