'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bookmark, Compass, House, Map } from 'lucide-react';
import { useAppStore, useHydrated } from '@/stores/app';
import AssistantOrb from '@/components/brand/AssistantOrb';
import { cn } from '@/lib/utils';

const tabs = [
    { label: 'Inicio', path: '/', icon: House },
    { label: 'Mapa', path: '/mapa', icon: Map },
    { label: 'Asistente', path: '/asistente', icon: null },
    { label: 'Explorar', path: '/explorar', icon: Compass },
    { label: 'Guardados', path: '/favoritos', icon: Bookmark },
];

/** Full-screen experiences bring their own navigation. */
const HIDDEN_ON = ['/mapa', '/viaje', '/asistente', '/planear', '/sigue'];

export default function BottomNav() {
    const pathname = usePathname();
    const hydrated = useHydrated();
    const favCount = useAppStore((s) => s.favorites.length);
    const trip = useAppStore((s) => s.activeTrip);

    if (HIDDEN_ON.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;

    return (
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/92 backdrop-blur-xl border-t border-border pb-[env(safe-area-inset-bottom)]" aria-label="Navegación principal">
            {hydrated && trip && (
                <Link
                    href="/viaje"
                    className="flex items-center justify-center gap-2 bg-foreground text-background py-1.5 text-13 font-semibold"
                >
                    <span className="live-dot" />
                    Viaje en curso a {trip.to.name} · Volver
                </Link>
            )}
            <div className="max-w-lg mx-auto grid grid-cols-5 items-end h-[var(--bottom-nav-height)] px-2">
                {tabs.map((tab) => {
                    const active = tab.path === '/' ? pathname === '/' : pathname.startsWith(tab.path);
                    if (!tab.icon) {
                        return (
                            <Link key={tab.path} href={tab.path} className="flex flex-col items-center justify-end pb-2 gap-1" aria-label="Asistente con IA">
                                <AssistantOrb size={50} className="-mt-5 shadow-[0_6px_24px_rgba(0,0,0,0.35)]" />
                                <span className="text-11 font-medium text-muted-foreground">{tab.label}</span>
                            </Link>
                        );
                    }
                    const Icon = tab.icon;
                    return (
                        <Link
                            key={tab.path}
                            href={tab.path}
                            className="relative flex flex-col items-center justify-center gap-1 h-full"
                            aria-current={active ? 'page' : undefined}
                        >
                            <span className="relative">
                                <Icon className={cn('w-[22px] h-[22px] transition-colors', active ? 'text-foreground' : 'text-muted-foreground')} strokeWidth={active ? 2.4 : 1.8} />
                                {tab.path === '/favoritos' && hydrated && favCount > 0 && (
                                    <span className="absolute -top-1.5 -right-2.5 min-w-4 h-4 px-1 rounded-full bg-foreground text-background text-10 font-bold flex items-center justify-center tabular">
                                        {favCount > 9 ? '9+' : favCount}
                                    </span>
                                )}
                            </span>
                            <span className={cn('text-11 transition-colors', active ? 'text-foreground font-semibold' : 'text-muted-foreground font-medium')}>
                                {tab.label}
                            </span>
                            {active && <span className="nav-indicator absolute top-0 left-1/2 -translate-x-1/2 h-[3px] rounded-b-full bg-foreground" />}
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
