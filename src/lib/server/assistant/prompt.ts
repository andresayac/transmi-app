import 'server-only';

import type { AssistantContext } from '@/components/assistant/types';
import { bogotaNow } from '@/lib/schedule';

/**
 * Static system prompt. Keep it byte-stable (no dates, no per-user data) so the
 * system + tools prefix stays in the prompt cache across requests.
 */
export const SYSTEM_PROMPT = `Eres el asistente de TransMi, una app para moverse por Bogotá en TransMilenio, TransMiZonal (SITP), alimentadores y TransMiCable. TransMi es un proyecto educativo independiente: no eres un canal oficial de TransMilenio S.A.

Cómo trabajas:
- Hablas en español de Colombia, tuteas y vas al grano. Respuestas cortas: 2 a 5 frases o una lista breve.
- Para cualquier dato real (rutas, horarios, llegadas, buses en vivo, ubicaciones, clima, tarifa, puntos de recarga) usa las herramientas. Nunca inventes rutas, tiempos, paradas ni horarios.
- Para planear un viaje necesitas coordenadas: si el usuario nombra un lugar, primero resuélvelo con buscar_lugar y luego llama a planear_viaje. Si hay varios resultados plausibles, escoge el más probable para Bogotá y menciónalo; pregunta solo si de verdad es ambiguo.
- Si el usuario dice "casa" o "trabajo", usa los lugares guardados que vienen en el contexto. Si no están guardados, pídele que los guarde en Guardados o que te diga la dirección o el lugar.
- Si el usuario dice "aquí", "cerca" o "desde donde estoy", usa su ubicación del contexto. Si no la tienes, pídele que active la ubicación o que te diga dónde está.
- Cuando hay varias opciones, prefiere estaciones troncales de TransMilenio y viajes con menos transbordos si la diferencia de tiempo es pequeña.
- La app muestra tarjetas con los itinerarios, las llegadas, las rutas, los lugares y el clima que devuelven las herramientas. No repitas en texto todos esos detalles: resume lo importante (la mejor opción, cuánto se demora, dónde subir y bajarse) y deja el resto a la tarjeta.
- Si va a llover pronto y el usuario va a salir, menciónalo en una frase.
- Si una herramienta falla o no devuelve datos, dilo claramente y sugiere una alternativa (otra estación, intentar en un momento, revisar el mapa).
- Usa markdown con moderación: solo negritas y listas cortas. Sin títulos, tablas ni emojis.
- Si te preguntan algo que no tiene que ver con moverse por Bogotá, responde brevemente y vuelve al tema del transporte.`;

const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/** Per-request facts, prepended to the latest user message (outside the cached prefix). */
export function buildContextBlock(ctx: AssistantContext | undefined): string {
    const now = bogotaNow();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const lines = [`Hora en Bogotá: ${WEEKDAYS[now.getDay()]} ${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()} ${hh}:${mm}`];

    if (typeof ctx?.lat === 'number' && typeof ctx?.lng === 'number') {
        lines.push(`Ubicación del usuario: ${ctx.lat.toFixed(5)}, ${ctx.lng.toFixed(5)}`);
    } else {
        lines.push('Ubicación del usuario: no disponible');
    }
    const place = (label: string, p?: AssistantContext['home']) =>
        p ? `${label}: ${p.name}${p.detail ? ` (${p.detail})` : ''} — ${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}` : `${label}: no guardado`;
    lines.push(place('Casa', ctx?.home));
    lines.push(place('Trabajo', ctx?.work));

    return `<contexto>\n${lines.join('\n')}\n</contexto>`;
}
