'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { Download, Share, SquarePlus, X } from 'lucide-react';
import TransMiLogo from '@/components/ui/TransMiLogo';

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'transmi-install-dismissed';
const SNOOZE_MS = 14 * 24 * 60 * 60 * 1000;

const noopSubscribe = () => () => undefined;

function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function isIOS() {
    return /iPhone|iPad|iPod/i.test(navigator.userAgent) && !/CriOS|FxiOS|EdgiOS/i.test(navigator.userAgent);
}

function recentlyDismissed() {
    try {
        const at = Number(localStorage.getItem(DISMISS_KEY));
        return Number.isFinite(at) && Date.now() - at < SNOOZE_MS;
    } catch {
        return false;
    }
}

/**
 * "Instala TransMi": on Android/Chrome it triggers the system install prompt;
 * on iPhone (no prompt there) it shows the two taps to add it to the home screen.
 */
export default function InstallBanner() {
    const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
    const [hidden, setHidden] = useState(false);
    const iosEligible = useSyncExternalStore(noopSubscribe, () => isIOS() && !isStandalone() && !recentlyDismissed(), () => false);

    useEffect(() => {
        const onPrompt = (e: Event) => {
            e.preventDefault();
            if (!recentlyDismissed()) setDeferred(e as BeforeInstallPromptEvent);
        };
        const onInstalled = () => setHidden(true);
        window.addEventListener('beforeinstallprompt', onPrompt);
        window.addEventListener('appinstalled', onInstalled);
        return () => {
            window.removeEventListener('beforeinstallprompt', onPrompt);
            window.removeEventListener('appinstalled', onInstalled);
        };
    }, []);

    const dismiss = () => {
        try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* private mode */ }
        setHidden(true);
    };

    const install = async () => {
        if (!deferred) return;
        await deferred.prompt();
        const { outcome } = await deferred.userChoice.catch(() => ({ outcome: 'dismissed' as const }));
        setDeferred(null);
        if (outcome === 'dismissed') dismiss();
        else setHidden(true);
    };

    if (hidden || (!deferred && !iosEligible)) return null;

    return (
        <section aria-label="Instalar TransMi" className="relative rounded-2xl bg-secondary p-4 pr-11">
            <button type="button" onClick={dismiss} className="absolute right-2 top-2 w-9 h-9 rounded-full flex items-center justify-center hover:bg-accent" aria-label="Ahora no">
                <X className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-3">
                <span className="w-12 h-12 rounded-xl bg-background flex items-center justify-center shrink-0">
                    <TransMiLogo size={32} />
                </span>
                <div className="min-w-0">
                    <p className="font-signage text-[20px] font-bold leading-tight">Ten TransMi a un toque</p>
                    <p className="text-[13px] text-muted-foreground leading-snug">Instálala en tu pantalla de inicio: abre al instante y funciona como una app.</p>
                </div>
            </div>
            {deferred ? (
                <button type="button" onClick={install} className="mt-3 h-10 px-4 rounded-full bg-foreground text-background text-[14px] font-semibold inline-flex items-center gap-2 active:scale-95">
                    <Download className="w-4 h-4" /> Instalar
                </button>
            ) : (
                <p className="mt-3 text-[13px] leading-relaxed">
                    Toca <Share className="inline w-4 h-4 -mt-0.5" aria-label="Compartir" /> <b>Compartir</b> y luego <SquarePlus className="inline w-4 h-4 -mt-0.5" aria-hidden /> <b>Agregar a inicio</b>.
                </p>
            )}
        </section>
    );
}
