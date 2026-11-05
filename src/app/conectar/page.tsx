'use client';

import { useState, useSyncExternalStore } from 'react';
import { Check, Copy } from 'lucide-react';
import AppHeader from '@/components/layout/AppHeader';
import { useToast } from '@/components/ui/Toast';

const REPO = 'https://github.com/andresayac/transmi-app';

const QUESTIONS = [
    '¿Cómo llego de Portal Norte a Unicentro si salgo a las 6 p. m.?',
    '¿Cuándo pasa la B13 por la Calle 72?',
    '¿Qué tan llena va la K23 ahora?',
    '¿Dónde recargo la TuLlave cerca del Parque de la 93?',
];

const noSubscription = () => () => { };

function CopyButton({ text, label }: { text: string; label: string }) {
    const toast = useToast();
    const [copied, setCopied] = useState(false);

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            toast.show('Copiado', 'success');
            setTimeout(() => setCopied(false), 2000);
        } catch {
            toast.show('No se pudo copiar: selecciónalo y cópialo a mano', 'error');
        }
    };

    return (
        <button
            onClick={copy}
            disabled={!text}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-background hover:bg-accent active:scale-90 disabled:opacity-40"
            aria-label={label}
            title={label}
        >
            {copied ? <Check className="h-[18px] w-[18px]" /> : <Copy className="h-[18px] w-[18px]" />}
        </button>
    );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
    return (
        <li className="flex gap-3 text-15">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-foreground text-13 font-bold text-background tabular">{n}</span>
            <span className="pt-0.5">{children}</span>
        </li>
    );
}

/** How to use TransMi from Claude: the MCP server lives at /api/mcp on this same site. */
export default function ConectarPage() {
    // The address to paste is this site's own, whatever domain serves it
    const origin = useSyncExternalStore(noSubscription, () => window.location.origin, () => '');
    const url = origin && `${origin}/api/mcp`;
    const command = origin && `claude mcp add --transport http transmi ${url}`;

    return (
        <div className="safe-bottom">
            <AppHeader title="Conéctala a Claude" width="narrow" />

            <main className="px-4 pt-5 space-y-9 lg:max-w-3xl lg:mx-auto lg:px-8 lg:pt-4">
                <section>
                    <p className="text-15 text-muted-foreground">
                        Pregúntale a Claude cómo moverte por Bogotá y te responde con los datos en vivo de TransMi: viajes, llegadas, buses en vivo, recargas, clima y tarifa.
                    </p>
                    <div className="mt-4 rounded-2xl border border-border p-4">
                        <p className="text-13 font-semibold text-muted-foreground">Dirección del conector</p>
                        <div className="mt-1.5 flex items-center gap-3">
                            {url
                                ? <code className="min-w-0 flex-1 wrap-anywhere text-15 font-semibold">{url}</code>
                                : <span className="h-5 flex-1 rounded bg-secondary animate-pulse" />}
                            <CopyButton text={url} label="Copiar la dirección" />
                        </div>
                    </div>
                    {origin && !origin.startsWith('https://') && (
                        <p className="mt-2 text-13 text-muted-foreground">
                            Claude se conecta desde internet y necesita una dirección pública con https: usa la del sitio publicado. En tu computador puedes probar con Claude Code.
                        </p>
                    )}
                </section>

                <section aria-labelledby="claude-title">
                    <h2 id="claude-title" className="font-signage text-24 font-bold">En Claude</h2>
                    <p className="text-14 text-muted-foreground mb-3">Se agrega desde la web o la app de escritorio; después también funciona en el celular.</p>
                    <ol className="space-y-3">
                        <Step n={1}>
                            Abre{' '}
                            <a href="https://claude.ai/settings/connectors" target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-2">
                                Configuración → Conectores
                            </a>.
                        </Step>
                        <Step n={2}>Elige <strong className="font-semibold">Agregar conector personalizado</strong> (<em>Add custom connector</em>).</Step>
                        <Step n={3}>Ponle de nombre <strong className="font-semibold">TransMi</strong>, pega la dirección y guarda.</Step>
                        <Step n={4}>En un chat, activa TransMi desde el botón <strong className="font-semibold">+</strong> y pregúntale.</Step>
                    </ol>
                    <p className="mt-3 text-13 text-muted-foreground">
                        En el plan gratuito de Claude puedes tener un conector personalizado. En los planes Team y Enterprise lo agrega quien administra la cuenta.
                    </p>
                </section>

                <section aria-labelledby="code-title">
                    <h2 id="code-title" className="font-signage text-24 font-bold">En Claude Code</h2>
                    <p className="text-14 text-muted-foreground mb-3">Pega esto en la terminal:</p>
                    <div className="flex items-center gap-3 rounded-2xl bg-secondary p-4">
                        <code className="min-w-0 flex-1 wrap-anywhere text-14">{command}</code>
                        <CopyButton text={command} label="Copiar el comando" />
                    </div>
                </section>

                <section aria-labelledby="preguntas-title">
                    <h2 id="preguntas-title" className="font-signage text-24 font-bold mb-3">Pregúntale, por ejemplo</h2>
                    <ul className="space-y-2">
                        {QUESTIONS.map((q) => (
                            <li key={q} className="rounded-2xl border border-border px-4 py-3 text-15">“{q}”</li>
                        ))}
                    </ul>
                </section>

                <p className="text-12 text-muted-foreground">
                    TransMi no le pasa a Claude tus lugares guardados ni tu ubicación: se quedan en este dispositivo, y no necesitas cuenta. El conector es de código abierto; mira cómo funciona o móntalo en tu propio servidor desde{' '}
                    <a href={REPO} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">GitHub</a>.
                </p>
            </main>
        </div>
    );
}
