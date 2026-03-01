'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const tabs = [
    {
        label: 'Inicio',
        path: '/',
        icon: (active: boolean) => (
            <svg className={`w-6 h-6 ${active ? 'text-foreground' : 'text-muted-foreground'}`} fill={active ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24" strokeWidth={active ? 0 : 1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline strokeLinecap="round" strokeLinejoin="round" points="9 22 9 12 15 12 15 22" />
            </svg>
        ),
    },
    {
        label: 'Explorar',
        path: '/explorar',
        icon: (active: boolean) => (
            <svg className={`w-6 h-6 ${active ? 'text-foreground' : 'text-muted-foreground'}`} fill={active ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24" strokeWidth={active ? 0 : 1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7l6-3 5.447 2.724A1 1 0 0121 7.618v10.764a1 1 0 01-1.447.894L15 17l-6 3z" />
            </svg>
        ),
    },
    {
        label: 'Mapa',
        path: '/mapa',
        icon: (active: boolean) => (
            <svg className={`w-6 h-6 ${active ? 'text-foreground' : 'text-muted-foreground'}`} fill={active ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24" strokeWidth={active ? 0 : 1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
        ),
    },
    {
        label: 'Favoritos',
        path: '/favoritos',
        icon: (active: boolean) => (
            <svg className={`w-6 h-6 ${active ? 'text-foreground' : 'text-muted-foreground'}`} fill={active ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24" strokeWidth={active ? 0 : 1.8}>
                {active ? (
                    <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                )}
            </svg>
        ),
    },
];

export default function BottomNav() {
    const pathname = usePathname();
    const router = useRouter();
    const [favCount, setFavCount] = useState(0);

    useEffect(() => {
        const updateCount = () => {
            try {
                const stored = localStorage.getItem('transmilenio_favorites');
                if (stored) {
                    const arr = JSON.parse(stored);
                    setFavCount(Array.isArray(arr) ? arr.length : 0);
                }
            } catch { setFavCount(0); }
        };
        updateCount();
        // Listen for storage changes (cross-tab + same-tab via custom event)
        window.addEventListener('storage', updateCount);
        window.addEventListener('favoritesChanged', updateCount);
        return () => {
            window.removeEventListener('storage', updateCount);
            window.removeEventListener('favoritesChanged', updateCount);
        };
    }, []);

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border">
            <div className="flex justify-around items-center h-[72px] max-w-lg mx-auto px-2 pb-[env(safe-area-inset-bottom)]">
                {tabs.map((tab) => {
                    const isActive = pathname === tab.path || (tab.path === '/explorar' && pathname?.startsWith('/explorar'));
                    const isFavTab = tab.path === '/favoritos';
                    return (
                        <button
                            key={tab.path}
                            onClick={() => router.push(tab.path)}
                            className="relative flex flex-col items-center justify-center gap-1 py-2 px-3 min-w-[56px] transition-all duration-200 active:scale-90"
                        >
                            <div className="relative">
                                {tab.icon(isActive)}
                                {/* Favorites badge */}
                                {isFavTab && favCount > 0 && (
                                    <span className="absolute -top-1.5 -right-2 min-w-[16px] h-[16px] rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center px-1 shadow-sm shadow-red-500/30">
                                        {favCount > 9 ? '9+' : favCount}
                                    </span>
                                )}
                            </div>
                            <span
                                className={`text-[10px] font-semibold tracking-wide transition-colors ${isActive ? 'text-foreground' : 'text-muted-foreground'
                                    }`}
                            >
                                {tab.label}
                            </span>
                            {isActive && (
                                <div className="h-[3px] rounded-full bg-foreground nav-indicator mt-0.5" />
                            )}
                        </button>
                    );
                })}
            </div>
        </nav>
    );
}
