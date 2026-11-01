'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Briefcase, Clock3, House, Loader2, LocateFixed, MapPin, Star, TrainFront, X } from 'lucide-react';
import type { PlanPlace } from '@/types/transit';
import { useAppStore, useHydrated } from '@/stores/app';
import { usePlaceSearch } from './usePlaceSearch';
import { cn } from '@/lib/utils';

interface PlaceSuggestionsProps {
    field: 'from' | 'to';
    initialQuery?: string;
    gps: { lat: number; lng: number } | null;
    gpsError: string | null;
    onRequestGps: () => void;
    onPick: (place: PlanPlace) => void;
    onClose: () => void;
}

type Assign = 'home' | 'work' | null;

function Row({ icon, title, detail, onClick, muted }: { icon: React.ReactNode; title: string; detail?: string; onClick: () => void; muted?: boolean }) {
    return (
        <button type="button" onClick={onClick} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent/60 active:bg-accent transition-colors">
            <span className={cn('w-9 h-9 shrink-0 rounded-full flex items-center justify-center', muted ? 'bg-secondary text-muted-foreground' : 'bg-foreground text-background')}>
                {icon}
            </span>
            <span className="flex-1 min-w-0">
                <span className="block truncate text-15 font-semibold text-foreground">{title}</span>
                {detail && <span className="block truncate text-12 text-muted-foreground">{detail}</span>}
            </span>
        </button>
    );
}

/**
 * Full-screen picker for "Desde" / "Hasta": quick places first (GPS, Casa,
 * Trabajo, saved, recent), then live search results as the rider types.
 */
export default function PlaceSuggestions({ field, initialQuery = '', gps, gpsError, onRequestGps, onPick, onClose }: PlaceSuggestionsProps) {
    const hydrated = useHydrated();
    const home = useAppStore((s) => s.home);
    const work = useAppStore((s) => s.work);
    const saved = useAppStore((s) => s.savedPlaces);
    const recent = useAppStore((s) => s.recentPlaces);
    const setHome = useAppStore((s) => s.setHome);
    const setWork = useAppStore((s) => s.setWork);

    const [query, setQuery] = useState(initialQuery);
    const [assign, setAssign] = useState<Assign>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const { places, loading, error } = usePlaceSearch(query, gps);

    useEffect(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
    }, []);

    const pick = (place: PlanPlace) => {
        if (assign === 'home') setHome(place);
        if (assign === 'work') setWork(place);
        onPick(assign ? { ...place, kind: assign } : place);
    };

    const startAssign = (target: Exclude<Assign, null>) => {
        setAssign(target);
        setQuery('');
        inputRef.current?.focus();
    };

    const searching = query.trim().length >= 2;
    const placeholder = assign === 'home'
        ? 'Busca la dirección de tu casa'
        : assign === 'work'
            ? 'Busca la dirección de tu trabajo'
            : field === 'from' ? '¿Desde dónde sales?' : '¿A dónde vas?';

    return (
        <div className="fixed inset-0 z-[60] bg-background flex flex-col animate-fade-in lg:right-auto lg:left-[var(--rail)] lg:w-[440px] lg:border-r lg:border-border" role="dialog" aria-label={field === 'from' ? 'Elegir origen' : 'Elegir destino'}>
            <div className="flex items-center gap-2 px-3 pt-[max(env(safe-area-inset-top),12px)] pb-3 border-b border-border">
                <button type="button" onClick={assign ? () => setAssign(null) : onClose} className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-accent active:scale-95" aria-label="Volver">
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="flex-1 relative">
                    <input
                        ref={inputRef}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={placeholder}
                        className="w-full h-11 pl-4 pr-10 rounded-xl bg-secondary text-16 text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-ring"
                        enterKeyHint="search"
                        autoComplete="off"
                        aria-label={placeholder}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && places[0]) pick(places[0]);
                            if (e.key === 'Escape') onClose();
                        }}
                    />
                    {query && (
                        <button type="button" onClick={() => setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:bg-accent" aria-label="Borrar texto">
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]">
                {assign && (
                    <p className="px-4 pt-3 pb-1 text-13 text-muted-foreground">
                        Elige un resultado y quedará guardado como {assign === 'home' ? 'tu casa' : 'tu trabajo'}.
                    </p>
                )}

                {!searching && !assign && (
                    <div className="py-1">
                        {gps ? (
                            <Row icon={<LocateFixed className="w-4 h-4" />} title="Mi ubicación" detail="Usar dónde estás ahora" onClick={() => onPick({ name: 'Mi ubicación', lat: gps.lat, lng: gps.lng, kind: 'gps' })} />
                        ) : (
                            <Row
                                icon={<LocateFixed className="w-4 h-4" />}
                                title="Usar mi ubicación"
                                detail={gpsError || 'Permite el acceso a tu ubicación'}
                                onClick={onRequestGps}
                                muted
                            />
                        )}

                        {hydrated && (
                            <>
                                {home ? (
                                    <Row icon={<House className="w-4 h-4" />} title="Casa" detail={home.detail || home.name} onClick={() => onPick(home)} />
                                ) : (
                                    <Row icon={<House className="w-4 h-4" />} title="Guardar casa" detail="Llega a casa con un toque" onClick={() => startAssign('home')} muted />
                                )}
                                {work ? (
                                    <Row icon={<Briefcase className="w-4 h-4" />} title="Trabajo" detail={work.detail || work.name} onClick={() => onPick(work)} />
                                ) : (
                                    <Row icon={<Briefcase className="w-4 h-4" />} title="Guardar trabajo" detail="Para tus viajes de todos los días" onClick={() => startAssign('work')} muted />
                                )}

                                {saved.length > 0 && (
                                    <>
                                        <h3 className="px-4 pt-4 pb-1 text-13 font-semibold text-muted-foreground">Tus lugares</h3>
                                        {saved.map((p) => (
                                            <Row key={p.id} icon={<Star className="w-4 h-4" />} title={p.label} detail={p.detail || p.name} onClick={() => onPick(p)} muted />
                                        ))}
                                    </>
                                )}

                                {recent.length > 0 && (
                                    <>
                                        <h3 className="px-4 pt-4 pb-1 text-13 font-semibold text-muted-foreground">Recientes</h3>
                                        {recent.map((p, i) => (
                                            <Row key={`${p.lat},${p.lng},${i}`} icon={<Clock3 className="w-4 h-4" />} title={p.name} detail={p.detail} onClick={() => onPick(p)} muted />
                                        ))}
                                    </>
                                )}
                            </>
                        )}
                    </div>
                )}

                {searching && (
                    <div className="py-1">
                        {loading && places.length === 0 && (
                            <div className="flex items-center gap-2 px-4 py-4 text-14 text-muted-foreground">
                                <Loader2 className="w-4 h-4 animate-spin" /> Buscando lugares…
                            </div>
                        )}
                        {error && <p className="px-4 py-4 text-14 text-muted-foreground">{error}</p>}
                        {!loading && !error && places.length === 0 && (
                            <p className="px-4 py-4 text-14 text-muted-foreground">
                                No encontramos “{query.trim()}”. Prueba con una dirección (Calle 26 # 68) o el nombre de una estación.
                            </p>
                        )}
                        {places.map((p, i) => (
                            <Row
                                key={`${p.lat},${p.lng},${i}`}
                                icon={p.kind === 'station' ? <TrainFront className="w-4 h-4" /> : <MapPin className="w-4 h-4" />}
                                title={p.name}
                                detail={p.detail}
                                onClick={() => pick(p)}
                                muted={p.kind !== 'station'}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
