'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { AssistantContext, AssistantEvent, AssistantPart, ChatTurn, UiMessage } from './types';

const STORAGE_KEY = 'transmi-assistant-chat';

const uid = () => Math.random().toString(36).slice(2, 10);

function loadSaved(): UiMessage[] {
    try {
        const raw = sessionStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const saved = JSON.parse(raw) as UiMessage[];
        // A reply interrupted by navigation can't resume: keep what arrived.
        return saved
            .map((m) => (m.status === 'streaming' ? { ...m, status: m.content ? ('done' as const) : ('error' as const), error: m.content ? undefined : { message: 'La respuesta se interrumpió.' } } : m))
            .slice(-40);
    } catch {
        return [];
    }
}

function applyEvent(message: UiMessage, event: AssistantEvent): UiMessage {
    const parts = [...message.parts];
    switch (event.type) {
        case 'text': {
            const last = parts[parts.length - 1];
            if (last?.type === 'text') parts[parts.length - 1] = { type: 'text', text: last.text + event.delta };
            else parts.push({ type: 'text', text: event.delta.replace(/^\n+/, '') });
            return { ...message, parts, content: message.content + event.delta };
        }
        case 'tool': {
            const idx = parts.findIndex((p) => p.type === 'tool' && p.id === event.id);
            const part: AssistantPart = { type: 'tool', id: event.id, name: event.name, status: event.status, label: event.label };
            if (idx >= 0) parts[idx] = part;
            else parts.push(part);
            return { ...message, parts };
        }
        case 'card':
            parts.push({ type: 'card', card: event.card });
            return { ...message, parts };
        case 'error':
            return { ...message, status: 'error', error: { message: event.message, code: event.code } };
        case 'done':
            return { ...message, status: message.status === 'error' ? 'error' : 'done' };
    }
}

/** Turns sent to the model: text only, failed replies dropped. */
function toTurns(messages: UiMessage[]): ChatTurn[] {
    return messages
        .filter((m) => m.role === 'user' || (m.status !== 'error' && m.content.trim()))
        .map((m) => ({ role: m.role, content: m.content }));
}

export function useAssistantChat(getContext: () => AssistantContext) {
    const [messages, setMessages] = useState<UiMessage[]>([]);
    const [streaming, setStreaming] = useState(false);
    const [notConfigured, setNotConfigured] = useState(false);
    const [restored, setRestored] = useState(false);
    const controller = useRef<AbortController | null>(null);
    const contextRef = useRef(getContext);
    const messagesRef = useRef<UiMessage[]>([]);

    useEffect(() => {
        contextRef.current = getContext;
    }, [getContext]);

    useEffect(() => {
        messagesRef.current = messages;
    }, [messages]);

    useEffect(() => {
        setMessages(loadSaved());
        setRestored(true);
        return () => controller.current?.abort();
    }, []);

    useEffect(() => {
        if (!restored) return;
        try {
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
        } catch { /* storage full or unavailable */ }
    }, [messages, restored]);

    const update = useCallback((id: string, fn: (m: UiMessage) => UiMessage) => {
        setMessages((prev) => prev.map((m) => (m.id === id ? fn(m) : m)));
    }, []);

    const run = useCallback(async (history: UiMessage[]) => {
        controller.current?.abort();
        const ctrl = new AbortController();
        controller.current = ctrl;

        const reply: UiMessage = { id: uid(), role: 'assistant', content: '', parts: [], status: 'streaming' };
        messagesRef.current = [...history, reply];
        setMessages(messagesRef.current);
        setStreaming(true);

        try {
            const res = await fetch('/api/asistente', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: toTurns(history), context: contextRef.current() }),
                signal: ctrl.signal,
            });

            if (!res.ok || !res.body) {
                const body = await res.json().catch(() => ({}));
                if (body?.error === 'assistant_not_configured') {
                    setNotConfigured(true);
                    update(reply.id, (m) => ({ ...m, status: 'error', error: { message: 'El asistente no está configurado.', code: 'not_configured' } }));
                } else {
                    update(reply.id, (m) => ({ ...m, status: 'error', error: { message: body?.error || 'No pudimos conectar con el asistente.', code: body?.code } }));
                }
                return;
            }

            setNotConfigured(false);
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let gotTerminal = false;

            const handleLine = (line: string) => {
                const trimmed = line.trim();
                if (!trimmed) return;
                let event: AssistantEvent;
                try {
                    event = JSON.parse(trimmed) as AssistantEvent;
                } catch {
                    return;
                }
                if (event.type === 'done') gotTerminal = true;
                update(reply.id, (m) => applyEvent(m, event));
            };

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() ?? '';
                lines.forEach(handleLine);
            }
            buffer += decoder.decode();
            handleLine(buffer);

            if (!gotTerminal) {
                update(reply.id, (m) => (m.status === 'streaming'
                    ? { ...m, status: m.content ? 'done' : 'error', error: m.content ? undefined : { message: 'La conexión se cortó antes de terminar.' } }
                    : m));
            }
        } catch (err) {
            if ((err as Error).name === 'AbortError') {
                update(reply.id, (m) => ({ ...m, status: m.content ? 'done' : 'error', error: m.content ? undefined : { message: 'Detuviste la respuesta.' } }));
            } else {
                update(reply.id, (m) => ({ ...m, status: 'error', error: { message: 'Sin conexión. Revisa tu internet e intenta de nuevo.' } }));
            }
        } finally {
            if (controller.current === ctrl) controller.current = null;
            setStreaming(false);
        }
    }, [update]);

    const send = useCallback((text: string) => {
        const content = text.trim();
        if (!content || streaming) return;
        const user: UiMessage = { id: uid(), role: 'user', content, parts: [{ type: 'text', text: content }], status: 'done' };
        run([...messagesRef.current, user]);
    }, [run, streaming]);

    /** Re-run the last user message after a failed reply. */
    const retry = useCallback(() => {
        if (streaming) return;
        const prev = messagesRef.current;
        const lastUser = prev.map((m) => m.role).lastIndexOf('user');
        if (lastUser < 0) return;
        run(prev.slice(0, lastUser + 1));
    }, [run, streaming]);

    const stop = useCallback(() => controller.current?.abort(), []);

    const reset = useCallback(() => {
        controller.current?.abort();
        setMessages([]);
        try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    }, []);

    return { messages, streaming, notConfigured, send, retry, stop, reset };
}
