'use client';

import { useMemo, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Briefcase, ChevronRight, House, MapPin, Navigation, Pencil, Plus, Share2, Trash2, X } from 'lucide-react';
import AppHeader from '@/components/layout/AppHeader';
import PlacePicker from '@/components/places/PlacePicker';
import VoicePicker from '@/components/places/VoicePicker';
import RouteBadge from '@/components/transit/RouteBadge';
import { planHref } from '@/components/home/PlannerHero';
import { useToast } from '@/components/ui/Toast';
import { SavedPlace, TextSize, ThemePref, useAppStore, useHydrated } from '@/stores/app';
import { shareRoute } from '@/utils/share';
import { ROUTE_COLORS } from '@/utils/constants';
import type { PlanPlace } from '@/types/transit';
import { cn } from '@/lib/utils';
import { phoneAsksToSaveData, useDataSaver } from '@/lib/dataSaver';
import { pushSubscription, pushSupport } from '@/lib/pwa';

function timeAgo(dateStr: string): string {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const days = Math.floor((Date.now() - d.getTime()) / 86400000);
    if (days < 1) return 'hoy';
    if (days === 1) return 'ayer';
    if (days < 30) return `hace ${days} días`;
    const months = Math.floor(days / 30);
    return `hace ${months} ${months === 1 ? 'mes' : 'meses'}`;
}

function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
    return (
        <div role="radiogroup" aria-label={label} className="inline-grid grid-flow-col auto-cols-fr p-1 rounded-xl bg-secondary">
            {options.map((o) => (
                <button
                    key={o.value}
                    role="radio"
                    aria-checked={value === o.value}
                    onClick={() => onChange(o.value)}
                    className={cn('h-8 px-3 rounded-lg text-13 font-semibold transition', value === o.value ? 'bg-background shadow-sm' : 'text-muted-foreground')}
                >
                    {o.label}
                </button>
            ))}
        </div>
    );
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (on: boolean) => void; label: string }) {
    return (
        <button
            role="switch"
            aria-checked={checked}
            onClick={() => onChange(!checked)}
            className={cn('relative w-12 h-7 rounded-full transition shrink-0', checked ? 'bg-foreground' : 'bg-secondary ring-1 ring-border')}
        >
            <span className={cn('absolute top-1 w-5 h-5 rounded-full transition-all', checked ? 'left-6 bg-background' : 'left-1 bg-muted-foreground')} />
            <span className="sr-only">{label}</span>
        </button>
    );
}

const noopSubscribe = () => () => undefined;

/** Alerts with TransMi closed: needs notification permission (asked on the tap) and, on iPhone, the installed app. */
function LockAlertsRow() {
    const on = useAppStore((s) => s.settings.lockAlerts);
    const updateSettings = useAppStore((s) => s.updateSettings);
    const support = useSyncExternalStore(noopSubscribe, pushSupport, () => 'unsupported' as const);
    const [blocked, setBlocked] = useState(false);
    const denied = support === 'ok' && (blocked || Notification.permission === 'denied');

    const toggle = async (next: boolean) => {
        if (!next) {
            updateSettings({ lockAlerts: false });
            return;
        }
        if (support !== 'ok') return;
        const permission = Notification.permission === 'default' ? await Notification.requestPermission().catch(() => 'denied' as const) : Notification.permission;
        if (permission !== 'granted') {
            setBlocked(true);
            return;
        }
        await pushSubscription().catch(() => undefined);
        updateSettings({ lockAlerts: true });
    };

    const hint = support === 'install'
        ? 'En iPhone, primero instala TransMi en tu pantalla de inicio'
        : support === 'unsupported'
            ? 'Este navegador no los permite'
            : denied
                ? 'Las notificaciones están bloqueadas: actívalas en los ajustes del teléfono'
                : 'Te avisamos antes de bajarte aunque uses otra app';

    return (
        <div className="flex items-center justify-between gap-3 py-3">
            <span>
                <span className="block text-15 font-medium">Avisos con la app cerrada</span>
                <span className="block text-13 text-muted-foreground">{hint}</span>
            </span>
            <Switch checked={on && support === 'ok' && !denied} onChange={toggle} label="Avisos con la app cerrada" />
        </div>
    );
}

type Editing = 'home' | 'work' | 'new' | null;

function PlaceRow({ icon: Icon, label, place, onEdit, onRemove }: { icon: typeof House; label: string; place: PlanPlace | null; onEdit: () => void; onRemove?: () => void }) {
    return (
        <div className="flex items-center gap-3 py-3 border-b border-border last:border-0">
            <span className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center shrink-0">
                <Icon className="w-[18px] h-[18px]" />
            </span>
            <button onClick={onEdit} className="flex-1 min-w-0 text-left">
                <span className="block font-signage text-19 font-semibold leading-tight">{label}</span>
                <span className="block text-13 text-muted-foreground truncate">{place ? (place.detail ? `${place.name} · ${place.detail}` : place.name) : 'Toca para agregar'}</span>
            </button>
            {place ? (
                <div className="flex items-center shrink-0">
                    <Link href={planHref(place)} className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-accent" aria-label={`Cómo llegar a ${label}`}>
                        <Navigation className="w-[17px] h-[17px]" />
                    </Link>
                    <button onClick={onEdit} className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-accent" aria-label={`Cambiar ${label}`}>
                        <Pencil className="w-4 h-4 text-muted-foreground" />
                    </button>
                    {onRemove && (
                        <button onClick={onRemove} className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-accent" aria-label={`Quitar ${label}`}>
                            <Trash2 className="w-4 h-4 text-muted-foreground" />
                        </button>
                    )}
                </div>
            ) : (
                <button onClick={onEdit} className="w-9 h-9 rounded-full border border-border flex items-center justify-center" aria-label={`Agregar ${label}`}>
                    <Plus className="w-4 h-4" />
                </button>
            )}
        </div>
    );
}

export default function GuardadosPage() {
    const router = useRouter();
    const toast = useToast();
    const hydrated = useHydrated();
    const s = useAppStore();
    const saving = useDataSaver();

    const [editing, setEditing] = useState<Editing>(null);
    const [pendingPlace, setPendingPlace] = useState<PlanPlace | null>(null);
    const [newLabel, setNewLabel] = useState('');

    const stats = useMemo(() => {
        const trips = s.trips;
        if (!trips.length) return null;
        const minutes = trips.reduce((a, t) => a + t.durationMin, 0);
        const km = trips.reduce((a, t) => a + t.distanceM, 0) / 1000;
        const lineCount: Record<string, number> = {};
        trips.forEach((t) => t.lines.forEach((l) => { lineCount[l] = (lineCount[l] || 0) + 1; }));
        const topLine = Object.entries(lineCount).sort((a, b) => b[1] - a[1])[0]?.[0];
        return { count: trips.length, minutes, km, co2: km * 0.12, topLine };
    }, [s.trips]);

    const pickPlace = (place: PlanPlace) => {
        if (editing === 'home') { s.setHome(place); toast.show('Casa guardada', 'success'); setEditing(null); }
        else if (editing === 'work') { s.setWork(place); toast.show('Trabajo guardado', 'success'); setEditing(null); }
        else { setPendingPlace(place); setNewLabel(place.name.slice(0, 24)); }
    };

    const saveNewPlace = () => {
        if (!pendingPlace || !newLabel.trim()) return;
        s.savePlace(pendingPlace, newLabel.trim());
        toast.show(`${newLabel.trim()} guardado`, 'success');
        setPendingPlace(null);
        setNewLabel('');
        setEditing(null);
    };

    const viewAllOnMap = () => {
        const mapped = s.favorites.slice(0, 10).map((f, i) => ({
            id: f.id,
            codigo: f.codigo,
            nombre: f.nombre,
            tipoServicio: f.tipo || '',
            color: ROUTE_COLORS[i % ROUTE_COLORS.length],
            originalColor: f.color || '#6b7280',
        }));
        sessionStorage.setItem('multiRoutes', JSON.stringify(mapped));
        router.push('/mapa?multi=true');
    };

    if (!hydrated) {
        return (
            <div className="safe-bottom">
                <AppHeader title="Guardados" />
                <div className="px-4 pt-6 space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-14 rounded-xl bg-secondary animate-pulse" />)}</div>
            </div>
        );
    }

    return (
        <div className="safe-bottom">
            <AppHeader title="Guardados" />

            {/* Computers: what you saved on the left, settings on the right (the phone's order, side by side) */}
            <main className="px-4 pt-5 space-y-9 lg:max-w-6xl lg:mx-auto lg:px-8 lg:pt-4 lg:space-y-0 lg:grid lg:grid-cols-[minmax(0,1fr)_440px] lg:gap-x-12 lg:items-start">
                <div className="space-y-9">
                    {/* ── Places ─────────────────────── */}
                    <section id="lugares" aria-labelledby="lugares-title" className="scroll-mt-20">
                        <h2 id="lugares-title" className="font-signage text-24 font-bold">Tus lugares</h2>
                        <p className="text-14 text-muted-foreground mb-2">Planea con un toque desde el inicio, y el asistente entiende “llévame a casa”.</p>

                        {editing && (
                            <div className="my-3 space-y-2">
                                <p className="text-14 font-semibold">
                                    {editing === 'home' ? 'Elige tu casa' : editing === 'work' ? 'Elige tu trabajo' : 'Nuevo lugar'}
                                </p>
                                {pendingPlace ? (
                                    <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); saveNewPlace(); }}>
                                        <input
                                            value={newLabel}
                                            onChange={(e) => setNewLabel(e.target.value)}
                                            autoFocus
                                            aria-label="Nombre del lugar"
                                            placeholder="Nombre: Universidad, Gimnasio…"
                                            className="flex-1 h-11 rounded-xl bg-secondary px-3.5 text-16 outline-none focus:ring-2 focus:ring-ring"
                                        />
                                        <button type="submit" className="h-11 px-4 rounded-xl bg-foreground text-background font-semibold text-14">Guardar</button>
                                        <button type="button" onClick={() => { setPendingPlace(null); setEditing(null); }} className="w-11 h-11 rounded-xl border border-border flex items-center justify-center" aria-label="Cancelar"><X className="w-4 h-4" /></button>
                                    </form>
                                ) : (
                                    <PlacePicker onPick={pickPlace} onCancel={() => setEditing(null)} />
                                )}
                            </div>
                        )}

                        <div>
                            <PlaceRow icon={House} label="Casa" place={s.home} onEdit={() => setEditing('home')} onRemove={s.home ? () => s.setHome(null) : undefined} />
                            <PlaceRow icon={Briefcase} label="Trabajo" place={s.work} onEdit={() => setEditing('work')} onRemove={s.work ? () => s.setWork(null) : undefined} />
                            {s.savedPlaces.map((p: SavedPlace) => (
                                <PlaceRow key={p.id} icon={MapPin} label={p.label} place={p} onEdit={() => router.push(planHref(p))} onRemove={() => s.removePlace(p.id)} />
                            ))}
                        </div>
                        {!editing && (
                            <button onClick={() => setEditing('new')} className="mt-2 inline-flex items-center gap-2 h-10 px-4 rounded-full border border-border text-14 font-semibold hover:bg-accent">
                                <Plus className="w-4 h-4" /> Agregar lugar
                            </button>
                        )}
                    </section>

                    {/* ── Routes ─────────────────────── */}
                    <section aria-labelledby="rutas-title">
                        <div className="flex items-baseline justify-between">
                            <h2 id="rutas-title" className="font-signage text-24 font-bold">Rutas guardadas</h2>
                            {s.favorites.length > 1 && (
                                <button onClick={viewAllOnMap} className="text-14 font-medium text-muted-foreground hover:text-foreground">Ver todas en el mapa</button>
                            )}
                        </div>
                        {s.favorites.length === 0 ? (
                            <p className="text-14 text-muted-foreground mt-1">
                                Toca la estrella en cualquier ruta para tenerla aquí. <Link href="/explorar" className="underline underline-offset-4 text-foreground">Buscar rutas</Link>
                            </p>
                        ) : (
                            <div className="mt-1">
                                {s.favorites.map((f) => (
                                    <div key={f.id} className="flex items-center gap-3 py-3 border-b border-border last:border-0">
                                        <button
                                            onClick={() => router.push(`/mapa?${new URLSearchParams({ id: f.id, nombre: f.nombre, codigo: f.codigo }).toString()}`)}
                                            className="flex items-center gap-3 flex-1 min-w-0 text-left"
                                        >
                                            <RouteBadge code={f.codigo} color={f.color} size="md" />
                                            <span className="min-w-0">
                                                <span className="block font-signage text-18 font-semibold leading-tight truncate">{f.nombre}</span>
                                                <span className="block text-12 text-muted-foreground">{f.tipo} · guardada {timeAgo(f.addedAt)}</span>
                                            </span>
                                        </button>
                                        <button
                                            onClick={async () => { const r = await shareRoute(f); if (r.success && r.method === 'clipboard') toast.show('Enlace copiado', 'success'); }}
                                            className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-accent" aria-label={`Compartir ${f.codigo}`}
                                        >
                                            <Share2 className="w-[17px] h-[17px] text-muted-foreground" />
                                        </button>
                                        <button
                                            onClick={() => { s.removeFavorite(f.id); toast.show(`${f.codigo} quitada de guardados`, 'info'); }}
                                            className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-accent" aria-label={`Quitar ${f.codigo}`}
                                        >
                                            <Trash2 className="w-4 h-4 text-muted-foreground" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>

                    {/* ── Mobility stats ─────────────── */}
                    <section aria-labelledby="movilidad-title">
                        <h2 id="movilidad-title" className="font-signage text-24 font-bold">Tu movilidad</h2>
                        {stats ? (
                            <div className="mt-2 rounded-2xl bg-black text-white p-5 relative overflow-hidden ring-1 ring-white/10">
                                <div className="absolute inset-x-0 top-0 system-stripe h-[4px]" aria-hidden />
                                <p className="font-signage text-40 font-bold leading-none tabular">{stats.count} {stats.count === 1 ? 'viaje' : 'viajes'}</p>
                                <p className="mt-2 text-15 text-white/75 tabular">
                                    {stats.minutes >= 90 ? `${(stats.minutes / 60).toFixed(1)} horas` : `${stats.minutes} minutos`} en el sistema · {stats.km.toFixed(1)} km recorridos
                                </p>
                                <p className="mt-1 text-14 text-white/55">
                                    ≈ {stats.co2.toFixed(1)} kg de CO₂ que no emitiste frente a ir en carro (estimado)
                                </p>
                                {stats.topLine && (
                                    <p className="mt-4 flex items-center gap-2 text-14 text-white/75">
                                        Tu línea más usada <RouteBadge code={stats.topLine} size="sm" />
                                    </p>
                                )}
                            </div>
                        ) : (
                            <p className="text-14 text-muted-foreground mt-1">
                                Cuando completes viajes con el modo viaje, aquí verás tus minutos, kilómetros y la línea que más usas. <Link href="/planear" className="underline underline-offset-4 text-foreground">Planear un viaje</Link>
                            </p>
                        )}
                    </section>

                    {/* ── Settings ───────────────────── */}
                </div>

                <section aria-labelledby="ajustes-title" className="pb-4 lg:rounded-[22px] lg:border lg:border-border lg:p-6">
                    <h2 id="ajustes-title" className="font-signage text-24 font-bold mb-2">Ajustes</h2>
                    <div className="divide-y divide-border">
                        <div className="flex items-center justify-between gap-3 py-3">
                            <span className="text-15 font-medium">Tema</span>
                            <Segmented<ThemePref>
                                label="Tema"
                                value={s.settings.theme}
                                onChange={(theme) => s.updateSettings({ theme })}
                                options={[{ value: 'system', label: 'Auto' }, { value: 'light', label: 'Claro' }, { value: 'dark', label: 'Oscuro' }]}
                            />
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-3 py-3">
                            <span className="text-15 font-medium">Tamaño de letra</span>
                            <Segmented<TextSize>
                                label="Tamaño de letra"
                                value={s.settings.textSize}
                                onChange={(textSize) => s.updateSettings({ textSize })}
                                options={[{ value: 'normal', label: 'Normal' }, { value: 'large', label: 'Grande' }, { value: 'xlarge', label: 'Muy grande' }]}
                            />
                        </div>
                        <div className="flex items-center justify-between gap-3 py-3">
                            <span>
                                <span className="block text-15 font-medium">Más contraste</span>
                                <span className="block text-13 text-muted-foreground">Textos y bordes más marcados, para leer bajo el sol</span>
                            </span>
                            <Switch checked={s.settings.highContrast} onChange={(highContrast) => s.updateSettings({ highContrast })} label="Más contraste" />
                        </div>
                        <div className="flex items-center justify-between gap-3 py-3">
                            <span className="text-15 font-medium">Luz del mapa</span>
                            <Segmented
                                label="Luz del mapa"
                                value={s.settings.mapLight}
                                onChange={(mapLight) => s.updateSettings({ mapLight })}
                                options={[{ value: 'auto', label: 'Real' }, { value: 'day', label: 'Día' }, { value: 'night', label: 'Noche' }]}
                            />
                        </div>
                        <div className="flex items-center justify-between gap-3 py-3">
                            <span>
                                <span className="block text-15 font-medium">Ahorro de datos</span>
                                <span className="block text-13 text-muted-foreground">
                                    {s.settings.dataSaver === 'auto' && saving && phoneAsksToSaveData()
                                        ? 'Encendido porque tu teléfono pidió ahorrar datos'
                                        : 'Mapa solo cuando lo pidas, menos actualizaciones y la voz del teléfono'}
                                </span>
                            </span>
                            <Switch checked={saving} onChange={(on) => s.updateSettings({ dataSaver: on ? 'on' : 'off' })} label="Ahorro de datos" />
                        </div>
                        <div className="flex items-center justify-between gap-3 py-3">
                            <span>
                                <span className="block text-15 font-medium">Avisos por voz en viaje</span>
                                <span className="block text-13 text-muted-foreground">Te anuncia la próxima parada y cuándo bajarte</span>
                            </span>
                            <Switch checked={s.settings.voice} onChange={(voice) => s.updateSettings({ voice })} label="Avisos por voz" />
                        </div>
                        <VoicePicker value={s.settings.ttsVoice} onChange={(ttsVoice) => s.updateSettings({ ttsVoice })} />
                        <div className="flex items-center justify-between gap-3 py-3">
                            <span>
                                <span className="block text-15 font-medium">Despiértame</span>
                                <span className="block text-13 text-muted-foreground">Paradas antes de tu destino</span>
                            </span>
                            <Segmented
                                label="Paradas antes del aviso"
                                value={String(s.settings.alarmStops)}
                                onChange={(v) => s.updateSettings({ alarmStops: Number(v) })}
                                options={[{ value: '1', label: '1' }, { value: '2', label: '2' }, { value: '3', label: '3' }]}
                            />
                        </div>
                        <LockAlertsRow />
                        <Link href="/conectar" className="flex items-center justify-between gap-3 py-3">
                            <span>
                                <span className="block text-15 font-medium">Úsala desde Claude o ChatGPT</span>
                                <span className="block text-13 text-muted-foreground">Pregúntales por tus viajes con los datos de TransMi</span>
                            </span>
                            <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                        </Link>
                        <div className="flex flex-wrap gap-2 pt-4">
                            {s.searchHistory.length > 0 && (
                                <button onClick={() => { s.clearSearches(); toast.show('Historial borrado', 'info'); }} className="h-9 px-3.5 rounded-full border border-border text-13 font-medium hover:bg-accent">
                                    Borrar búsquedas
                                </button>
                            )}
                            {s.trips.length > 0 && (
                                <button
                                    onClick={() => { if (confirm('¿Borrar el historial de viajes?')) { useAppStore.setState({ trips: [] }); toast.show('Viajes borrados', 'info'); } }}
                                    className="h-9 px-3.5 rounded-full border border-border text-13 font-medium hover:bg-accent"
                                >
                                    Borrar viajes
                                </button>
                            )}
                        </div>
                    </div>
                    <p className="text-12 text-muted-foreground mt-6">
                        TransMi es un proyecto educativo y no es la app oficial de TransMilenio. Los datos pertenecen a TransMilenio S.A. Tus lugares y viajes se guardan solo en este dispositivo.
                    </p>
                </section>
            </main>
        </div>
    );
}
