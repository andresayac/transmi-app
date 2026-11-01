'use client';

import { useEffect, useState } from 'react';
import { BusFront, Check, Copy, Share2, ShieldCheck, X } from 'lucide-react';
import type { ActiveTrip } from '@/stores/app';
import { useAppStore } from '@/stores/app';
import { packTrip, shareUrl } from '@/lib/tripShare';
import { formatTime } from '@/lib/schedule';
import RouteBadge from '@/components/transit/RouteBadge';
import { stopLabel } from '@/components/plan/utils';
import type { MyBus } from './useMyBus';

interface ShareTripSheetProps {
    trip: ActiveTrip;
    currentLeg: number;
    eta: Date | null;
    bus: MyBus | null;
    onClose: () => void;
}

/**
 * "Sigue mi viaje": a link anyone can open to watch the bus the rider is on and
 * the expected arrival. Sent through whatever app the person prefers.
 */
export default function ShareTripSheet({ trip, currentLeg, eta, bus, onClose }: ShareTripSheetProps) {
    const shareName = useAppStore((s) => s.settings.shareName);
    const updateSettings = useAppStore((s) => s.updateSettings);
    const [name, setName] = useState(shareName);
    const [copied, setCopied] = useState(false);

    const leg = trip.itinerary.legs[currentLeg];
    const riding = leg?.mode === 'TRANSIT' && leg.line;
    const destination = stopLabel(trip.to.name).station;
    const etaText = eta ? formatTime(eta) : null;

    // Built when sharing, so the link carries the exact moment it was sent
    const buildUrl = () => shareUrl(packTrip(trip, { currentLeg, etaMs: eta ? eta.getTime() : Date.now(), bus: riding ? bus?.label : null, by: name }));
    const host = typeof window !== 'undefined' ? window.location.host : '';

    const message = riding
        ? `Voy en la ${leg.line!.code} hacia ${leg.line!.longName || leg.line!.name}. Llego a ${destination}${etaText ? ` aprox. a las ${etaText}` : ''}. ${bus ? 'Sigue mi bus en vivo' : 'Sigue mi viaje'}:`
        : `Voy en camino a ${destination}${etaText ? `, llego aprox. a las ${etaText}` : ''}. Sigue mi viaje:`;

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    const remember = () => {
        if (name.trim() !== shareName) updateSettings({ shareName: name.trim() });
    };

    const share = async () => {
        remember();
        try {
            if (navigator.share) {
                await navigator.share({ title: 'Sigue mi viaje', text: message, url: buildUrl() });
                onClose();
                return;
            }
        } catch (err) {
            if ((err as Error).name === 'AbortError') return;
        }
        await copy();
    };

    const copy = async () => {
        remember();
        try {
            await navigator.clipboard.writeText(`${message} ${buildUrl()}`);
            setCopied(true);
            setTimeout(() => setCopied(false), 2500);
        } catch { /* clipboard blocked: the link is visible to copy by hand */ }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-end justify-center" role="dialog" aria-modal="true" aria-labelledby="share-title">
            <button type="button" className="absolute inset-0 bg-black/50 animate-fade-in" onClick={onClose} aria-label="Cerrar" />
            <div className="relative w-full max-w-lg rounded-t-[24px] bg-background border-t border-border p-5 pb-[max(env(safe-area-inset-bottom),20px)] animate-slide-up">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <h2 id="share-title" className="font-signage text-28 font-bold leading-tight">Sigue mi viaje</h2>
                        <p className="text-14 text-muted-foreground">Envía un enlace para que vean tu bus y a qué hora llegas.</p>
                    </div>
                    <button type="button" onClick={onClose} className="w-10 h-10 -mr-2 rounded-full flex items-center justify-center hover:bg-accent" aria-label="Cerrar">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* What the other person will see */}
                <div className="mt-4 rounded-2xl border border-border p-4">
                    {riding && bus ? (
                        <div className="flex items-center gap-3">
                            <span className="relative w-10 h-10 rounded-full flex items-center justify-center bg-foreground text-background">
                                <BusFront className="w-5 h-5" />
                                <span className="absolute -right-0.5 -top-0.5 live-dot" />
                            </span>
                            <div className="min-w-0">
                                <p className="text-15 font-semibold flex items-center gap-2">Vas en el bus {bus.label} <RouteBadge code={leg.line!.code} color={leg.line!.color} size="xs" /></p>
                                <p className="text-13 text-muted-foreground">Quien abra el enlace verá este bus moverse en vivo.</p>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-3">
                            <span className="w-10 h-10 rounded-full flex items-center justify-center bg-secondary">
                                <BusFront className="w-5 h-5 text-muted-foreground" />
                            </span>
                            <p className="text-13 text-muted-foreground">
                                {riding
                                    ? 'Aún no identificamos tu bus. Verán tu ruta y la hora estimada; si compartes en un par de minutos, verán el bus en vivo.'
                                    : 'Verán tu ruta y la hora estimada de llegada. Cuando vayas en el bus, comparte de nuevo para que lo vean en vivo.'}
                            </p>
                        </div>
                    )}
                </div>

                <label className="mt-4 block">
                    <span className="text-13 text-muted-foreground">Tu nombre (opcional)</span>
                    <input
                        value={name}
                        onChange={(e) => setName(e.target.value.slice(0, 40))}
                        onBlur={remember}
                        placeholder="Para que sepan quién comparte"
                        autoComplete="given-name"
                        className="mt-1 w-full h-11 rounded-xl bg-secondary px-3.5 text-16 outline-none focus:ring-2 focus:ring-ring"
                    />
                </label>

                <p className="mt-4 rounded-xl bg-secondary px-3.5 py-3 text-14 leading-snug">
                    {message} <span className="text-muted-foreground break-all">{host}/sigue#…</span>
                </p>

                <div className="mt-4 flex gap-2">
                    <button
                        type="button"
                        onClick={share}
                        className="flex-1 h-12 rounded-full bg-foreground text-background font-signage text-20 font-bold inline-flex items-center justify-center gap-2 active:scale-[0.98]"
                    >
                        <Share2 className="w-5 h-5" /> Compartir
                    </button>
                    <button
                        type="button"
                        onClick={copy}
                        className="h-12 px-4 rounded-full border border-border inline-flex items-center gap-2 text-14 font-semibold active:scale-[0.98]"
                    >
                        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        {copied ? 'Copiado' : 'Copiar'}
                    </button>
                </div>

                <p className="mt-3 flex items-start gap-1.5 text-12 text-muted-foreground">
                    <ShieldCheck className="w-3.5 h-3.5 mt-px shrink-0" />
                    El enlace muestra el bus y tu destino, no la ubicación de tu celular. No se guarda en ningún servidor.
                </p>
            </div>
        </div>
    );
}
