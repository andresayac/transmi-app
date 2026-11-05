'use client';

import { useState, useSyncExternalStore } from 'react';
import { Check, Copy } from 'lucide-react';
import AppHeader from '@/components/layout/AppHeader';
import Segmented from '@/components/ui/Segmented';
import { useToast } from '@/components/ui/Toast';

const REPO = 'https://github.com/andresayac/transmi-app';

const QUESTIONS = [
    '¿Cómo llego de Portal Norte a Unicentro si salgo a las 6 p. m.?',
    '¿Cuándo pasa la B13 por la Calle 72?',
    '¿Qué tan llena va la K23 ahora?',
    '¿Cuánto saldo tiene mi TuLlave? Y si está bajo, ¿dónde recargo cerca del Parque de la 93?',
    '¿Mi hermana ya casi llega? Me mandó este enlace de Sigue mi viaje…',
];

type App = 'claude' | 'chatgpt' | 'gemini';

const APPS: { value: App; label: string }[] = [
    { value: 'claude', label: 'Claude' },
    { value: 'chatgpt', label: 'ChatGPT' },
    { value: 'gemini', label: 'Gemini' },
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

/** One app's steps: who can use it, the steps, and the fine print. */
function Guide({ lead, steps, note }: { lead: string; steps: React.ReactNode[]; note: string }) {
    return (
        <>
            <p className="text-14 text-muted-foreground mb-3">{lead}</p>
            <ol className="space-y-3">
                {steps.map((step, i) => <Step key={i} n={i + 1}>{step}</Step>)}
            </ol>
            <p className="mt-3 text-13 text-muted-foreground">{note}</p>
        </>
    );
}

const GUIDES: Record<App, React.ReactNode> = {
    claude: (
        <Guide
            lead="Se agrega desde la web o la app de escritorio; después también funciona en el celular."
            steps={[
                <>
                    Abre{' '}
                    <a href="https://claude.ai/settings/connectors" target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-2">
                        Configuración → Conectores
                    </a>.
                </>,
                <>Elige <strong className="font-semibold">Agregar conector personalizado</strong> (<em>Add custom connector</em>).</>,
                <>Ponle de nombre <strong className="font-semibold">TransMi</strong>, pega la dirección y guarda.</>,
                <>En un chat, activa TransMi desde el botón <strong className="font-semibold">+</strong> y pregúntale.</>,
            ]}
            note="En el plan gratuito de Claude puedes tener un conector personalizado. En los planes Team y Enterprise lo agrega quien administra la cuenta."
        />
    ),
    chatgpt: (
        <Guide
            lead="Con un plan de pago (Plus, Pro, Business, Enterprise o Edu), desde chatgpt.com."
            steps={[
                <>
                    En <strong className="font-semibold">Configuración → Apps y conectores → Avanzado</strong>, activa el{' '}
                    <strong className="font-semibold">Modo desarrollador</strong> (<em>Developer mode</em>).
                </>,
                <>Vuelve a <strong className="font-semibold">Apps y conectores</strong> y toca <strong className="font-semibold">Crear</strong> (<em>Create</em>).</>,
                <>
                    Ponle de nombre <strong className="font-semibold">TransMi</strong>, pega la dirección, elige{' '}
                    <strong className="font-semibold">Sin autenticación</strong> (<em>No authentication</em>), confirma que confías en la app y créala.
                </>,
                <>En un chat, toca <strong className="font-semibold">+ → Más → Modo desarrollador</strong>, activa TransMi y pregúntale.</>,
            ]}
            note="En los planes Business y Enterprise, quien administra la cuenta debe permitir el modo desarrollador. Los nombres de los menús pueden cambiar un poco."
        />
    ),
    gemini: (
        <Guide
            lead="Por ahora Google lo ofrece solo en Estados Unidos, en inglés y con una cuenta personal de Google (mayores de 18 años): desde Colombia todavía no aparece."
            steps={[
                <>
                    En{' '}
                    <a href="https://gemini.google.com" target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-2">gemini.google.com</a>, abre{' '}
                    <strong className="font-semibold">Settings → Connected Apps</strong> (si no aparece, entra por <em>Personal Intelligence</em>).
                </>,
                <>En <strong className="font-semibold">Custom apps</strong>, toca <strong className="font-semibold">Add a custom app</strong>.</>,
                <>Pega la dirección, toca <strong className="font-semibold">Next</strong> y sigue las instrucciones.</>,
                <>En un chat, escribe <strong className="font-semibold">@</strong>, elige TransMi y pregúntale.</>,
            ]}
            note="Se agrega desde la web y luego funciona también en el celular. Necesita la actividad de Gemini activada (Keep Activity)."
        />
    ),
};

/** How to use TransMi from Claude, ChatGPT, Gemini and other MCP apps: the server lives at /api/mcp on this same site. */
export default function ConectarPage() {
    // The address to paste is this site's own, whatever domain serves it
    const origin = useSyncExternalStore(noSubscription, () => window.location.origin, () => '');
    const url = origin && `${origin}/api/mcp`;
    const command = origin && `claude mcp add --transport http transmi ${url}`;
    const [app, setApp] = useState<App>('claude');

    return (
        <div className="safe-bottom">
            <AppHeader title="Conéctala a tu IA" width="narrow" />

            <main className="px-4 pt-5 space-y-9 lg:max-w-3xl lg:mx-auto lg:px-8 lg:pt-4">
                <section>
                    <p className="text-15 text-muted-foreground">
                        Pregúntale a Claude, ChatGPT o Gemini cómo moverte por Bogotá y te responde con los datos en vivo de TransMi: viajes, llegadas, buses en vivo, rutas, troncales y zonas, saldo de la TuLlave, recargas abiertas, viajes compartidos, clima y tarifa.
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
                            Estas apps se conectan desde internet y necesitan una dirección pública con https: usa la del sitio publicado. En tu computador puedes probar con Claude Code.
                        </p>
                    )}
                </section>

                <section aria-labelledby="app-title">
                    <h2 id="app-title" className="font-signage text-24 font-bold mb-3">¿Qué app usas?</h2>
                    <Segmented label="App de IA" value={app} onChange={setApp} options={APPS} className="w-full sm:w-auto mb-4" />
                    {GUIDES[app]}
                </section>

                <section aria-labelledby="code-title">
                    <h2 id="code-title" className="font-signage text-24 font-bold">En Claude Code y otras apps</h2>
                    <p className="text-14 text-muted-foreground mb-3">Para Claude Code, pega esto en la terminal:</p>
                    <div className="flex items-center gap-3 rounded-2xl bg-secondary p-4">
                        <code className="min-w-0 flex-1 wrap-anywhere text-14">{command}</code>
                        <CopyButton text={command} label="Copiar el comando" />
                    </div>
                    <p className="mt-3 text-13 text-muted-foreground">
                        Cualquier otra app compatible con MCP por HTTP sirve con la misma dirección, sin autenticación.
                    </p>
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
                    TransMi no le pasa a la IA tus lugares guardados ni tu ubicación: se quedan en este dispositivo, y no necesitas cuenta. El conector es de código abierto; mira cómo funciona o móntalo en tu propio servidor desde{' '}
                    <a href={REPO} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">GitHub</a>.
                </p>
            </main>
        </div>
    );
}
