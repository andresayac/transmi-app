'use client';

import { useEffect, useRef, useState } from 'react';
import { LocateFixed, Loader2, MapPin, Search, TrainFront, X } from 'lucide-react';
import type { PlanPlace } from '@/types/transit';
import { cn } from '@/lib/utils';

interface PlacePickerProps {
    onPick: (place: PlanPlace) => void;
    onCancel?: () => void;
    placeholder?: string;
    autoFocus?: boolean;
    allowGps?: boolean;
}

/** Inline place search: current location, stations and OpenStreetMap places in Bogotá. */
export default function PlacePicker({ onPick, onCancel, placeholder = 'Busca una dirección o lugar', autoFocus = true, allowGps = true }: PlacePickerProps) {
    const [q, setQ] = useState('');
    const [results, setResults] = useState<PlanPlace[]>([]);
    const [loading, setLoading] = useState(false);
    const [locating, setLocating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const ctrl = useRef<AbortController | null>(null);

    useEffect(() => {
        if (timer.current) clearTimeout(timer.current);
        if (q.trim().length < 2) {
            ctrl.current?.abort();
            return;
        }
        timer.current = setTimeout(async () => {
            ctrl.current?.abort();
            const c = new AbortController();
            ctrl.current = c;
            setLoading(true);
            try {
                const res = await fetch(`/api/geocode?q=${encodeURIComponent(q.trim())}`, { signal: c.signal });
                const data = await res.json();
                setResults(data.places || []);
                setError(res.ok ? null : data.error);
            } catch (err) {
                if ((err as Error).name !== 'AbortError') setError('No pudimos buscar lugares. Revisa tu conexión.');
            }
            setLoading(false);
        }, 250);
        return () => { if (timer.current) clearTimeout(timer.current); };
    }, [q]);

    const useGps = () => {
        if (!navigator.geolocation) { setError('Tu navegador no permite ubicación'); return; }
        setLocating(true);
        navigator.geolocation.getCurrentPosition(async (pos) => {
            const { latitude: lat, longitude: lng } = pos.coords;
            try {
                const res = await fetch(`/api/geocode/reverse?lat=${lat}&lng=${lng}`);
                const place = await res.json();
                onPick({ ...place, lat, lng });
            } catch {
                onPick({ name: 'Mi ubicación', lat, lng, kind: 'map' });
            }
            setLocating(false);
        }, () => {
            setLocating(false);
            setError('Activa el permiso de ubicación para usar tu posición actual');
        }, { enableHighAccuracy: true, timeout: 12000 });
    };

    return (
        <div className="rounded-2xl border border-border bg-background overflow-hidden">
            <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-muted-foreground" />
                <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    autoFocus={autoFocus}
                    placeholder={placeholder}
                    aria-label={placeholder}
                    className="w-full h-12 bg-transparent pl-11 pr-11 text-[16px] outline-none placeholder:text-muted-foreground"
                />
                {(loading || onCancel) && (
                    <span className="absolute right-2 top-1/2 -translate-y-1/2">
                        {loading ? <Loader2 className="w-4 h-4 m-2.5 animate-spin text-muted-foreground" /> : (
                            <button onClick={onCancel} className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-accent" aria-label="Cancelar">
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </span>
                )}
            </div>
            <div className="border-t border-border max-h-72 overflow-y-auto">
                {allowGps && (
                    <button onClick={useGps} disabled={locating} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent active:bg-accent">
                        <LocateFixed className={cn('w-[18px] h-[18px]', locating && 'animate-spin')} />
                        <span className="text-[15px] font-medium">{locating ? 'Buscando tu ubicación…' : 'Usar mi ubicación actual'}</span>
                    </button>
                )}
                {results.map((p, i) => {
                    const Icon = p.kind === 'station' ? TrainFront : MapPin;
                    return (
                        <button key={`${p.lat},${p.lng},${i}`} onClick={() => onPick(p)} className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-accent active:bg-accent">
                            <Icon className="w-[18px] h-[18px] text-muted-foreground shrink-0" />
                            <span className="min-w-0">
                                <span className="block text-[15px] font-medium truncate">{p.name}</span>
                                {p.detail && <span className="block text-[12px] text-muted-foreground truncate">{p.detail}</span>}
                            </span>
                        </button>
                    );
                })}
                {error && <p className="px-4 py-3 text-[13px] text-destructive">{error}</p>}
            </div>
        </div>
    );
}
