'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bookmark, Compass, House, Map, Route } from 'lucide-react';
import { useAppStore, useHydrated } from '@/stores/app';
import AssistantOrb from '@/components/brand/AssistantOrb';
import TransMiLogo from '@/components/ui/TransMiLogo';
import { cn } from '@/lib/utils';
import ThemeToggle from './ThemeToggle';

const items = [
    { label: 'Inicio', path: '/', icon: House },
    { label: 'Planear', path: '/planear', icon: Route },
    { label: 'Mapa', path: '/mapa', icon: Map },
    { label: 'Asistente', path: '/asistente', icon: null },
    { label: 'Explorar', path: '/explorar', icon: Compass },
    { label: 'Guardados', path: '/favoritos', icon: Bookmark },
];

/** The page people open to follow someone's trip isn't part of the app's navigation. */
const HIDDEN_ON = ['/sigue'];

/**
 * Computer navigation: the bottom bar stood up along the left edge, with the
 * troncal colors as its spine. `data-rail` makes room for it (see globals.css).
 */
export default function SideRail() {
    const pathname = usePathname();
    const hydrated = useHydrated();
    const favCount = useAppStore((s) => s.favorites.length);
    const trip = useAppStore((s) => s.activeTrip);

    if (HIDDEN_ON.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;

    return (
        <nav data-rail aria-label="Navegación principal" className="hidden lg:flex fixed inset-y-0 left-0 z-50 w-[5.5rem] flex-col items-stretch bg-background pt-5 pb-4">
            <span aria-hidden className="system-stripe-vertical absolute inset-y-0 right-0 w-[3px]" />

            <Link href="/" className="self-center mb-7 mr-[3px]" aria-label="TransMi, inicio">
                <TransMiLogo size={42} />
            </Link>

            <ul className="flex flex-col gap-1 mr-[3px]">
                {items.map((item) => {
                    const active = item.path === '/' ? pathname === '/' : pathname.startsWith(item.path);
                    const Icon = item.icon;
                    return (
                        <li key={item.path}>
                            <Link
                                href={item.path}
                                aria-current={active ? 'page' : undefined}
                                className="group relative mx-2 flex flex-col items-center gap-1 rounded-2xl py-2.5 transition-colors hover:bg-accent"
                            >
                                {active && <span className="rail-indicator absolute -left-2 top-1/2 -translate-y-1/2 w-[3px] rounded-r-full bg-foreground" />}
                                {Icon ? (
                                    <span className="relative">
                                        <Icon className={cn('w-[22px] h-[22px]', active ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground')} strokeWidth={active ? 2.4 : 1.8} />
                                        {item.path === '/favoritos' && hydrated && favCount > 0 && (
                                            <span className="absolute -top-1.5 -right-2.5 min-w-4 h-4 px-1 rounded-full bg-foreground text-background text-10 font-bold flex items-center justify-center tabular">
                                                {favCount > 9 ? '9+' : favCount}
                                            </span>
                                        )}
                                    </span>
                                ) : (
                                    <AssistantOrb size={36} active={active} />
                                )}
                                <span className={cn('text-11', active ? 'text-foreground font-semibold' : 'text-muted-foreground font-medium group-hover:text-foreground')}>
                                    {item.label}
                                </span>
                            </Link>
                        </li>
                    );
                })}
            </ul>

            {hydrated && trip && pathname !== '/viaje' && (
                <Link
                    href="/viaje"
                    className="mx-2 mr-[11px] mt-4 flex flex-col items-center gap-1.5 rounded-2xl bg-foreground text-background py-3 active:scale-95 transition"
                    title={`Viaje en curso a ${trip.to.name}`}
                >
                    <span className="live-dot" />
                    <span className="text-11 font-semibold">Tu viaje</span>
                </Link>
            )}

            <ThemeToggle className="mt-auto self-center mr-[3px] w-11 h-11" />
        </nav>
    );
}
