'use client';

import { useEffect, useState } from 'react';
import { BusFront, Check, Copy, Loader2, Share2, ShieldCheck, X } from 'lucide-react';
import type { ActiveTrip } from '@/stores/app';
import { useAppStore } from '@/stores/app';
import { buildSharedTrip, packTrip, shareUrl, shortShareUrl, type ShareSnapshot } from '@/lib/tripShare';
import { formatTime } from '@/lib/schedule';
import RouteBadge from '@/components/transit/RouteBadge';
import { stopLabel } from '@/components/plan/utils';
import type { MyBus } from './useMyBus';
import { reportShare } from './useShareRelay';

interface ShareTripSheetProps {
    trip: ActiveTrip;
    currentLeg: number;
    /** Arrival for display (Bogotá wall clock) and as an instant (epoch ms) */
    eta: Date | null;
    etaMs: number | null;
    bus: MyBus | null;
    onClose: () => void;
}

/**
 * "Sigue mi viaje": a short link anyone can open to watch the bus the rider is
 * on (and the next one after a transfer) and the expected arrival. The link is
 * created as soon as the sheet opens, so sharing happens right on the tap
 * (iOS only allows the share sheet during the tap itself).
 */
export default function ShareTripSheet({ trip, currentLeg, eta, etaMs, bus, onClose }: ShareTripSheetProps) {
    const shareName = useAppStore((s) => s.settings.shareName);
    const updateSettings = useAppStore((s) => s.updateSettings);
    const setTripShare = useAppStore((s) => s.setTripShare);
    const [name, setName] = useState(shareName);
    const [copied, setCopied] = useState(false);
    // The short link couldn't be created: share the whole trip in a #link instead
    const [shortFailed, setShortFailed] = useState(false);

    const leg = trip.itinerary.legs[currentLeg];
    const riding = leg?.mode === 'TRANSIT' && leg.line;
    const destination = stopLabel(trip.to.name).station;
    const etaText = eta ? formatTime(eta) : null;
    const snapshot = (): ShareSnapshot => ({ currentLeg, etaMs: etaMs ?? Date.now(), bus: riding ? bus?.label : null, by: name });

    // Create the short link once per trip; sharing again reuses it
    const shareId = trip.share?.id;
    useEffect(() => {
        if (shareId) return;
        let cancelled = false;
        fetch('/api/sigue', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ trip: buildSharedTrip(trip, { currentLeg, etaMs: etaMs ?? Date.now(), bus: riding ? bus?.label : null, by: shareName }) }),
        })
            .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
            .then((created: { id: string; key: string }) => { if (!cancelled) setTripShare(created); })
            .catch(() => { if (!cancelled) setShortFailed(true); });
        return () => { cancelled = true; };
        // Created once, with what's known when the sheet opens; later changes travel as reports
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [shareId]);

    const creating = !shareId && !shortFailed;
    const url = shareId ? shortShareUrl(shareId) : shortFailed ? shareUrl(packTrip(trip, snapshot())) : '';

    const message = riding
        ? `Voy en la ${leg.line!.code} hacia ${leg.line!.longName || leg.line!.name}. Llego a ${destination}${etaText ? ` aprox. a las ${etaText}` : ''}. ${bus ? 'Sigue mi bus en vivo' : 'Sigue mi viaje'}:`
        : `Voy en camino a ${destination}${etaText ? `, llego aprox. a las ${etaText}` : ''}. Sigue mi viaje:`;

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    /** Save the name, and send it with the link if it changed after the link was made. */
    const remember = () => {
        const clean = name.trim();
        if (clean === shareName) return;
        updateSettings({ shareName: clean });
        if (trip.share) reportShare(trip.share.id, { key: trip.share.key, leg: currentLeg, bus: riding ? bus?.label ?? null : null, eta: etaMs, by: clean });
    };

    const share = async () => {
        if (!url) return;
        remember();
        try {
            if (navigator.share) {
                await navigator.share({ title: 'Sigue mi viaje', text: message, url });
                onClose();
                return;
            }
        } catch (err) {
            if ((err as Error).name === 'AbortError') return;
        }
        await copy();
    };

    const copy = async () => {
        if (!url) return;
        remember();
        try {
            await navigator.clipboard.writeText(`${message} ${url}`);
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
                            <span className="relative w-10 h-10 shrink-0 rounded-full flex items-center justify-center bg-foreground text-background">
                                <BusFront className="w-5 h-5" />
                                <span className="absolute -right-0.5 -top-0.5 live-dot" />
                            </span>
                            <div className="min-w-0">
                                <p className="text-15 font-semibold flex items-center gap-2">Vas en el bus {bus.label} <RouteBadge code={leg.line!.code} color={leg.line!.color} size="xs" /></p>
                                <p className="text-13 text-muted-foreground">
                                    {shortFailed ? 'Quien abra el enlace verá este bus moverse en vivo.' : 'Verán este bus en vivo, y el siguiente si haces transbordo.'}
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-3">
                            <span className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center bg-secondary">
                                <BusFront className="w-5 h-5 text-muted-foreground" />
                            </span>
                            <p className="text-13 text-muted-foreground">
                                {shortFailed
                                    ? 'Verán tu ruta y la hora estimada de llegada.'
                                    : 'Verán tu ruta y la hora estimada. Cuando TransMi reconozca tu bus, también en los transbordos, lo verán moverse en vivo.'}
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
                    {message}{' '}
                    <span className="text-muted-foreground break-all">
                        {creating ? 'creando enlace…' : shareId ? url.replace(/^https?:\/\//, '') : `${typeof window !== 'undefined' ? window.location.host : ''}/sigue#…`}
                    </span>
                </p>

                <div className="mt-4 flex gap-2">
                    <button
                        type="button"
                        onClick={share}
                        disabled={creating}
                        className="flex-1 h-12 rounded-full bg-foreground text-background font-signage text-20 font-bold inline-flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-60"
                    >
                        {creating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Share2 className="w-5 h-5" />} Compartir
                    </button>
                    <button
                        type="button"
                        onClick={copy}
                        disabled={creating}
                        className="h-12 px-4 rounded-full border border-border inline-flex items-center gap-2 text-14 font-semibold active:scale-[0.98] disabled:opacity-60"
                    >
                        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        {copied ? 'Copiado' : 'Copiar'}
                    </button>
                </div>

                <p className="mt-3 flex items-start gap-1.5 text-12 text-muted-foreground">
                    <ShieldCheck className="w-3.5 h-3.5 mt-px shrink-0" />
                    {shortFailed
                        ? 'El enlace muestra el bus y tu destino, nunca la ubicación de tu celular. No se guarda en ningún servidor.'
                        : 'El enlace muestra el bus y tu destino, nunca la ubicación de tu celular. Para seguir tus transbordos, TransMi solo recibe en qué bus vas, y borra el viaje a los 3 días.'}
                </p>
            </div>
        </div>
    );
}
