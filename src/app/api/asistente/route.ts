import { NextResponse } from 'next/server';
import { z } from 'zod/v4';
import { hasCredentials, mapAssistantError, MAX_TURNS, runAssistant } from '@/lib/server/assistant/run';
import { describeEndpoints, probeEndpoints } from '@/lib/server/assistant/probe';
import type { AssistantEvent } from '@/components/assistant/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const placeSchema = z.object({
    name: z.string().max(200),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    detail: z.string().max(300).optional(),
    kind: z.string().max(20).optional(),
}).nullable().optional();

const bodySchema = z.object({
    messages: z.array(z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().max(6000),
    })).min(1).max(MAX_TURNS * 3),
    context: z.object({
        lat: z.number().min(-90).max(90).optional(),
        lng: z.number().min(-180).max(180).optional(),
        home: placeSchema,
        work: placeSchema,
    }).optional(),
});

// GET /api/asistente            → which AI endpoint(s) are configured (never the key)
// GET /api/asistente?probar=1   → also checks connection, model and tool calling
export async function GET(request: Request) {
    const endpoints = describeEndpoints();
    if (!endpoints.length) {
        return NextResponse.json({ configured: false, help: 'Define AI_BASE_URL, AI_API_KEY y AI_MODEL en .env (cualquier API compatible con OpenAI).' });
    }
    if (new URL(request.url).searchParams.get('probar') !== '1') {
        return NextResponse.json({ configured: true, endpoints });
    }
    const checks = await probeEndpoints();
    return NextResponse.json({ configured: true, ok: checks.some((c) => c.reachable && c.toolCalls), checks });
}

// POST /api/asistente — streams NDJSON AssistantEvent lines (see components/assistant/types.ts)
export async function POST(request: Request) {
    if (!hasCredentials()) {
        return NextResponse.json({ error: 'assistant_not_configured' }, { status: 503 });
    }

    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 });
    }
    const { messages, context } = parsed.data;
    const last = messages[messages.length - 1];
    if (last.role !== 'user' || !last.content.trim()) {
        return NextResponse.json({ error: 'El último mensaje debe ser del usuario' }, { status: 400 });
    }
    if (last.content.length > 2000) {
        return NextResponse.json({ error: 'El mensaje es demasiado largo' }, { status: 400 });
    }

    const encoder = new TextEncoder();
    const abort = new AbortController();
    request.signal.addEventListener('abort', () => abort.abort());

    // Events are queued until the stream is returned; the first one tells us the call is alive.
    const queue: AssistantEvent[] = [];
    let push: ((event: AssistantEvent) => void) | null = null;
    let finished = false;
    let firstEvent: () => void = () => { };
    const started = new Promise<void>((resolve) => { firstEvent = resolve; });

    const emit = (event: AssistantEvent) => {
        if (push) push(event);
        else queue.push(event);
        firstEvent();
    };

    const run = runAssistant({
        turns: messages,
        context: {
            lat: context?.lat,
            lng: context?.lng,
            home: context?.home ? { ...context.home, kind: 'home' } : null,
            work: context?.work ? { ...context.work, kind: 'work' } : null,
        },
        emit,
        signal: abort.signal,
    }).then(
        () => ({ ok: true as const }),
        (error: unknown) => ({ ok: false as const, error }),
    ).finally(() => {
        finished = true;
        firstEvent();
    });

    await started;

    // Failed before producing anything: answer with a proper HTTP status.
    if (finished && queue.length === 0) {
        const outcome = await run;
        if (!outcome.ok) {
            if (abort.signal.aborted) return new Response(null, { status: 499 });
            const mapped = mapAssistantError(outcome.error);
            console.error('[asistente]', outcome.error instanceof Error ? outcome.error.message : outcome.error);
            return NextResponse.json(
                { error: mapped.code === 'not_configured' ? 'assistant_not_configured' : mapped.message, code: mapped.code },
                { status: mapped.status },
            );
        }
    }

    const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
            let closed = false;
            const write = (event: AssistantEvent) => {
                if (closed) return;
                try {
                    controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
                } catch {
                    closed = true;
                }
            };
            for (const event of queue.splice(0)) write(event);
            push = write;

            const outcome = await run;
            if (outcome.ok) {
                write({ type: 'done' });
            } else if (!abort.signal.aborted) {
                const mapped = mapAssistantError(outcome.error);
                console.error('[asistente]', outcome.error instanceof Error ? outcome.error.message : outcome.error);
                write({ type: 'error', code: mapped.code, message: mapped.message });
            }
            closed = true;
            try { controller.close(); } catch { /* already closed */ }
        },
        cancel() {
            abort.abort();
        },
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'application/x-ndjson; charset=utf-8',
            'Cache-Control': 'no-store, no-transform',
            'X-Accel-Buffering': 'no',
        },
    });
}
