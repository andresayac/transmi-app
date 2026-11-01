'use client';

import { BellOff, BellRing, Loader2, Share, SquarePlus } from 'lucide-react';
import type { LockAlertsStatus } from './useLockAlerts';

interface LockAlertsCardProps {
    status: LockAlertsStatus;
    /** On a bus leg right now */
    riding: boolean;
    /** Bus recognized for this leg */
    busLabel: string | null;
    onEnable: () => void;
    onRetry: () => void;
}

/** Trip screen: alerts while using another app, from turning them on to "you can switch apps now". */
export default function LockAlertsCard({ status, riding, busLabel, onEnable, onRetry }: LockAlertsCardProps) {
    if (status === 'unsupported') return null;

    if (status === 'off') {
        return (
            <button type="button" onClick={onEnable} className="mt-3 w-full min-h-11 py-2 px-4 rounded-full border border-border inline-flex items-center justify-center gap-2 text-14 font-semibold active:scale-[0.99]">
                <BellRing className="w-4 h-4 shrink-0" /> Avisarme aunque use otra app
            </button>
        );
    }

    if (status === 'install') {
        return (
            <p className="mt-3 rounded-2xl bg-secondary p-4 text-13 leading-relaxed">
                <b className="block text-14">¿Quieres los avisos mientras usas otra app?</b>
                En iPhone solo llegan con TransMi instalada: toca <Share className="inline w-4 h-4 -mt-0.5" aria-label="Compartir" /> <b>Compartir</b> y luego <SquarePlus className="inline w-4 h-4 -mt-0.5" aria-hidden /> <b>Agregar a inicio</b>.
            </p>
        );
    }

    if (status === 'denied') {
        return (
            <p className="mt-3 rounded-2xl bg-secondary p-4 text-13 leading-relaxed flex gap-3">
                <BellOff className="w-4 h-4 mt-0.5 shrink-0" />
                <span>Las notificaciones de TransMi están bloqueadas. Actívalas en los ajustes del teléfono para avisarte mientras usas otra app.</span>
            </p>
        );
    }

    if (status === 'starting') {
        return (
            <p className="mt-3 text-13 text-muted-foreground inline-flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Activando avisos con la app cerrada…
            </p>
        );
    }

    if (status === 'failed') {
        return (
            <div className="mt-3 rounded-2xl border border-border p-4">
                <p className="text-14 font-semibold">No se pudieron activar los avisos con la app cerrada</p>
                <p className="mt-0.5 text-13 text-muted-foreground">Mientras tanto, deja TransMi abierta para que te avise.</p>
                <button type="button" onClick={onRetry} className="mt-3 h-9 px-4 rounded-full bg-foreground text-background text-13 font-semibold">Reintentar</button>
            </div>
        );
    }

    // On: tell the rider when it's safe to switch apps
    const following = riding && busLabel;
    return (
        <div className="mt-3 rounded-2xl border border-border p-4 flex gap-3">
            <BellRing className="w-5 h-5 mt-0.5 shrink-0" />
            <div className="min-w-0">
                <p className="text-14 font-semibold">{following ? 'Ya puedes usar otra app' : 'Avisos con la app cerrada'}</p>
                <p className="mt-0.5 text-13 text-muted-foreground leading-snug">
                    {following
                        ? `Seguimos el bus ${busLabel} y te avisamos antes de bajarte, aunque TransMi esté cerrada.`
                        : 'Cuando subas al bus, deja TransMi abierta hasta que reconozca tu bus. Después puedes usar otra app.'}
                </p>
            </div>
        </div>
    );
}
