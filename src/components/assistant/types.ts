// Shared by the /api/asistente route and the /asistente page (no 'use client').
import type { Itinerary, PlanPlace, ServicePoint, WeatherNow } from '@/types/transit';
import type { ScheduleEntry } from '@/lib/schedule';

/** Rich, UI-ready results emitted by tools while the assistant works. */
export type AssistantCard =
    | { kind: 'itineraries'; from: PlanPlace; to: PlanPlace; itineraries: Itinerary[] }
    | { kind: 'arrivals'; paradero: string; title: string }
    | {
        kind: 'route';
        id: string;
        codigo: string;
        nombre: string;
        color: string;
        schedules: ScheduleEntry[];
        activeNow: boolean | null;
        stopCount: number;
        firstStop?: string;
        lastStop?: string;
    }
    | { kind: 'places'; title: string; places: (PlanPlace | ServicePoint)[] }
    | { kind: 'weather'; weather: WeatherNow };

/** NDJSON events streamed by POST /api/asistente, one JSON object per line. */
export type AssistantEvent =
    | { type: 'text'; delta: string }
    | { type: 'tool'; id: string; name: string; status: 'start' | 'done' | 'error'; label: string }
    | { type: 'card'; card: AssistantCard }
    | { type: 'done' }
    | { type: 'error'; message: string; code?: 'not_configured' | 'rate_limited' | 'refusal' | 'upstream' };

export interface AssistantContext {
    lat?: number;
    lng?: number;
    home?: PlanPlace | null;
    work?: PlanPlace | null;
}

export interface ChatTurn {
    role: 'user' | 'assistant';
    content: string;
}

/** A rendered piece of an assistant reply, kept in arrival order. */
export type AssistantPart =
    | { type: 'text'; text: string }
    | { type: 'tool'; id: string; name: string; status: 'start' | 'done' | 'error'; label: string }
    | { type: 'card'; card: AssistantCard };

export interface UiMessage {
    id: string;
    role: 'user' | 'assistant';
    /** User text, or the assistant's concatenated text (what goes back to the model) */
    content: string;
    parts: AssistantPart[];
    status?: 'streaming' | 'done' | 'error';
    error?: { message: string; code?: string };
}
