import 'server-only';

/**
 * The assistant only talks about getting around Bogotá. The system prompt asks
 * for that; this is the backstop for when a model goes along with an
 * off-topic request anyway: a transit answer never contains source code, so
 * code in the output means the reply is cut and replaced.
 */

export const OUT_OF_SCOPE_REPLY = 'Solo puedo ayudarte a moverte por Bogotá: planear viajes, rutas de TransMilenio y SITP, llegadas en vivo, tarifas y puntos de recarga. ¿A dónde quieres ir?';

const CODE_PATTERNS = [
    /```/,
    /^\s*(import\s+[\w{*]|from\s+[\w.]+\s+import\b|def\s+\w+\s*\(|class\s+\w+\s*[:({]|function\s+\w*\s*\(|(const|let|var)\s+\w+\s*=|console\.log\(|print\(|<\?php|#include\s*<|public\s+(static\s+)?\w+\s+\w+\s*\(|SELECT\s+.+\s+FROM\s)/im,
    /<(script|html|div)\b[^>]*>/i,
];

export function looksLikeCode(text: string): boolean {
    return CODE_PATTERNS.some((re) => re.test(text));
}

/** Thrown from the output stream to stop the model mid-reply. */
export class OutOfScopeOutput extends Error {
    constructor() {
        super('out_of_scope_output');
    }
}
