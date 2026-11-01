import 'server-only';

/** Client IP behind the reverse proxy (or "local" in development). */
export function clientIp(request: Request): string {
    return request.headers.get('x-forwarded-for')?.split(',')[0].trim() || request.headers.get('x-real-ip') || 'local';
}

/**
 * Fixed-window counter per IP, in memory (one Node process serves the app).
 * Generous for people, a wall for scripts filling the disk.
 */
export function rateLimit(name: string, windowMs: number, max: number): (ip: string) => boolean {
    const g = globalThis as typeof globalThis & { __rateLimits?: Map<string, Map<string, { count: number; since: number }>> };
    const all = (g.__rateLimits ??= new Map());
    const rate = all.get(name) ?? new Map<string, { count: number; since: number }>();
    all.set(name, rate);

    return (ip) => {
        const now = Date.now();
        const entry = rate.get(ip);
        if (!entry || now - entry.since > windowMs) {
            if (rate.size > 10000) rate.clear();
            rate.set(ip, { count: 1, since: now });
            return true;
        }
        entry.count++;
        return entry.count <= max;
    };
}
