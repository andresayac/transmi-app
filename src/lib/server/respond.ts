import 'server-only';

import { NextResponse } from 'next/server';
import { UpstreamError } from './upstream';

/** Wrap a route handler body: JSON on success, a clear error payload on failure. */
export async function respond<T>(label: string, run: () => Promise<T>, cacheSeconds = 0): Promise<NextResponse> {
    try {
        const data = await run();
        const headers: Record<string, string> = cacheSeconds
            ? { 'Cache-Control': `public, s-maxage=${cacheSeconds}, stale-while-revalidate=${cacheSeconds * 2}` }
            : { 'Cache-Control': 'no-store' };
        return NextResponse.json(data, { headers });
    } catch (error) {
        const status = error instanceof UpstreamError ? (error.status >= 500 ? 502 : error.status) : 500;
        console.error(`[${label}]`, error instanceof Error ? error.message : error);
        return NextResponse.json({ error: `No se pudo obtener ${label}. Intenta de nuevo en un momento.` }, { status });
    }
}

export function badRequest(message: string) {
    return NextResponse.json({ error: message }, { status: 400 });
}

export function num(value: string | null): number | null {
    if (value === null || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}
