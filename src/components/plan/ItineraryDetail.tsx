'use client';

import { useState } from 'react';
import { ArrowLeft, Briefcase, Footprints, House, Navigation, Repeat, Share2, Star } from 'lucide-react';
import type { Itinerary, PlanPlace } from '@/types/transit';
import { useAppStore } from '@/stores/app';
import { useToast } from '@/components/ui/Toast';
import { addMinutes, formatTime } from '@/lib/schedule';
import { formatDistance } from '@/lib/geo';
import SegmentBar from '@/components/transit/SegmentBar';
import ItineraryMap from './ItineraryMap';
import ItineraryTimeline from './ItineraryTimeline';
import NextDepartureHint from './NextDepartureHint';
import { plannerUrl, transferCount, transferText } from './utils';

interface ItineraryDetailProps {
    itinerary: Itinerary;
    from: PlanPlace;
    to: PlanPlace;
    departAt: Date | null;
    live: boolean;
    onBack: () => void;
    onStart: () => void;
}

/** Full-screen view of one option: map on top, steps and actions below. */
export default function ItineraryDetail({ itinerary, from, to, departAt, live, onBack, onStart }: ItineraryDetailProps) {
    const toast = useToast();
    const setHome = useAppStore((s) => s.setHome);
    const setWork = useAppStore((s) => s.setWork);
    const savePlace = useAppStore((s) => s.savePlace);
    const [saveOpen, setSaveOpen] = useState(false);
    const firstRide = itinerary.legs.find((l) => l.mode === 'TRANSIT');

    const share = async () => {
        const url = `${window.location.origin}${plannerUrl(from.kind === 'gps' ? null : from, to)}`;
        const text = `Ruta en TransMilenio a ${to.name}: ${itinerary.durationMin} min${firstRide?.line ? `, toma el ${firstRide.line.code}` : ''}.`;
        try {
            if (navigator.share) {
                await navigator.share({ title: `Cómo llegar a ${to.name}`, text, url });
                return;
            }
            await navigator.clipboard.writeText(`${text} ${url}`);
            toast.show('Enlace copiado', 'success');
        } catch (err) {
            if ((err as Error).name !== 'AbortError') toast.show('No se pudo compartir', 'error');
        }
    };

    const saveAs = (kind: 'home' | 'work' | 'place') => {
        if (kind === 'home') setHome(to);
        else if (kind === 'work') setWork(to);
        else savePlace(to, to.name);
        setSaveOpen(false);
        toast.show(kind === 'home' ? 'Guardado como casa' : kind === 'work' ? 'Guardado como trabajo' : 'Lugar guardado', 'success');
    };

    return (
        <div className="fixed inset-0 z-50 bg-background flex flex-col max-w-lg mx-auto animate-fade-in">
            <div className="relative h-[42dvh] shrink-0">
                <ItineraryMap itinerary={itinerary} from={from} to={to} padding={{ top: 80, bottom: 40, left: 40, right: 40 }} />
                <button
                    type="button"
                    onClick={onBack}
                    className="absolute left-3 top-[max(env(safe-area-inset-top),12px)] w-11 h-11 rounded-full glass flex items-center justify-center shadow-lg active:scale-95"
                    aria-label="Volver a las opciones"
                >
                    <ArrowLeft className="w-5 h-5 text-foreground" />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain -mt-4 relative rounded-t-[22px] bg-background border-t border-border">
                <div className="px-5 pt-5">
                    <div className="flex items-end justify-between gap-3">
                        <div>
                            <p className="font-signage tabular text-40 font-bold leading-none">
                                {itinerary.durationMin}<span className="text-22 font-semibold ml-1">min</span>
                            </p>
                            {departAt && (
                                <p className="mt-1 text-14 text-muted-foreground tabular">
                                    Llegas a las {formatTime(addMinutes(departAt, itinerary.durationMin))}
                                </p>
                            )}
                        </div>
                        <div className="text-right text-13 text-muted-foreground space-y-0.5">
                            <p className="inline-flex items-center gap-1.5"><Footprints className="w-3.5 h-3.5" />{formatDistance(itinerary.walkMeters)} a pie</p>
                            <p className="flex items-center justify-end gap-1.5"><Repeat className="w-3.5 h-3.5" />{transferText(transferCount(itinerary))}</p>
                        </div>
                    </div>
                    <SegmentBar legs={itinerary.legs} className="mt-4" />
                    {live && firstRide && <NextDepartureHint leg={firstRide} className="mt-3" />}
                </div>

                <div className="px-3 pt-5 pb-4">
                    <ItineraryTimeline itinerary={itinerary} from={from} to={to} departAt={departAt} />
                </div>

                {saveOpen && (
                    <div className="mx-5 mb-3 rounded-2xl border border-border p-2 grid grid-cols-3 gap-2 animate-slide-up">
                        <button type="button" onClick={() => saveAs('home')} className="flex flex-col items-center gap-1 py-2.5 rounded-xl hover:bg-accent text-13 font-medium"><House className="w-5 h-5" />Casa</button>
                        <button type="button" onClick={() => saveAs('work')} className="flex flex-col items-center gap-1 py-2.5 rounded-xl hover:bg-accent text-13 font-medium"><Briefcase className="w-5 h-5" />Trabajo</button>
                        <button type="button" onClick={() => saveAs('place')} className="flex flex-col items-center gap-1 py-2.5 rounded-xl hover:bg-accent text-13 font-medium"><Star className="w-5 h-5" />Lugar</button>
                    </div>
                )}
            </div>

            <div className="shrink-0 border-t border-border bg-background px-4 pt-3 pb-[max(env(safe-area-inset-bottom),12px)] flex items-center gap-2">
                <button
                    type="button"
                    onClick={() => setSaveOpen((v) => !v)}
                    className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center active:scale-95"
                    aria-label="Guardar destino"
                    aria-expanded={saveOpen}
                >
                    <Star className="w-5 h-5" />
                </button>
                <button type="button" onClick={share} className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center active:scale-95" aria-label="Compartir ruta">
                    <Share2 className="w-5 h-5" />
                </button>
                <button
                    type="button"
                    onClick={onStart}
                    className="flex-1 h-12 rounded-full bg-foreground text-background font-signage text-20 font-bold inline-flex items-center justify-center gap-2 active:scale-[0.98]"
                >
                    <Navigation className="w-5 h-5" /> Iniciar viaje
                </button>
            </div>
        </div>
    );
}
