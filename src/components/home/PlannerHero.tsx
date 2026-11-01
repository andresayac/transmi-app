'use client';

import Link from 'next/link';
import { Briefcase, Clock, House, MapPin, Plus, Search } from 'lucide-react';
import { useAppStore, useHydrated } from '@/stores/app';
import type { PlanPlace } from '@/types/transit';

export function planHref(to: PlanPlace, from?: PlanPlace | null): string {
    const q = new URLSearchParams({ toLat: String(to.lat), toLng: String(to.lng), toName: to.name });
    if (from) {
        q.set('fromLat', String(from.lat));
        q.set('fromLng', String(from.lng));
        q.set('fromName', from.name);
    }
    return `/planear?${q.toString()}`;
}

function Chip({ href, icon: Icon, label }: { href: string; icon: typeof House; label: string }) {
    return (
        <Link
            href={href}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full border border-border bg-background text-14 font-medium whitespace-nowrap hover:bg-accent active:scale-95 transition"
        >
            <Icon className="w-4 h-4 text-muted-foreground" />
            <span className="max-w-[140px] truncate">{label}</span>
        </Link>
    );
}

/** The home screen's main act: one big field that starts a trip. */
export default function PlannerHero() {
    const hydrated = useHydrated();
    const home = useAppStore((s) => s.home);
    const work = useAppStore((s) => s.work);
    const saved = useAppStore((s) => s.savedPlaces);
    const recent = useAppStore((s) => s.recentPlaces);

    const recentOnly = recent.filter((r) => ![home, work, ...saved].some((p) => p && Math.abs(p.lat - r.lat) < 0.0003 && Math.abs(p.lng - r.lng) < 0.0003)).slice(0, 3);

    return (
        <section aria-label="Planear un viaje">
            <Link
                href="/planear"
                className="group flex items-center gap-3 w-full rounded-2xl bg-foreground text-background px-5 h-[68px] shadow-[0_10px_30px_-12px_rgba(0,0,0,0.5)] active:scale-[0.99] transition"
            >
                <Search className="w-6 h-6 opacity-70" strokeWidth={2.4} />
                <span className="font-signage text-28 font-bold leading-none">¿A dónde vas?</span>
            </Link>

            <div className="flex gap-2 overflow-x-auto scrollbar-hidden mt-3 -mx-4 px-4 pb-1">
                {hydrated && (
                    <>
                        {home ? <Chip href={planHref(home)} icon={House} label="Casa" /> : <Chip href="/favoritos#lugares" icon={Plus} label="Agregar casa" />}
                        {work ? <Chip href={planHref(work)} icon={Briefcase} label="Trabajo" /> : <Chip href="/favoritos#lugares" icon={Plus} label="Agregar trabajo" />}
                        {saved.slice(0, 4).map((p) => <Chip key={p.id} href={planHref(p)} icon={MapPin} label={p.label} />)}
                        {recentOnly.map((p) => <Chip key={`${p.lat},${p.lng}`} href={planHref(p)} icon={Clock} label={p.name} />)}
                    </>
                )}
            </div>
        </section>
    );
}
