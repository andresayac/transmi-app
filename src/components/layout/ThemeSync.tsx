'use client';

import { useEffect } from 'react';
import { useAppStore, useHydrated } from '@/stores/app';

/** Inline script for <head>: applies the saved theme before first paint (no flash). */
export const themeBootScript = `(function(){try{var t='system';var raw=localStorage.getItem('transmi-store');if(raw){var s=JSON.parse(raw);t=(s.state&&s.state.settings&&s.state.settings.theme)||'system';}else{var d=localStorage.getItem('darkMode');if(d==='true')t='dark';else if(d==='false')t='light';}var dark=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',dark);}catch(e){}})();`;

/** Keeps the <html> class and the browser theme color in sync with the user's preference. */
export default function ThemeSync() {
    const hydrated = useHydrated();
    const theme = useAppStore((s) => s.settings.theme);

    useEffect(() => {
        if (!hydrated) return;
        const media = window.matchMedia('(prefers-color-scheme: dark)');
        const apply = () => {
            const dark = theme === 'dark' || (theme === 'system' && media.matches);
            document.documentElement.classList.toggle('dark', dark);
            document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', dark ? '#000000' : '#ffffff'));
        };
        apply();
        media.addEventListener('change', apply);
        return () => media.removeEventListener('change', apply);
    }, [theme, hydrated]);

    return null;
}
