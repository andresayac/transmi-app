'use client';

import { useEffect } from 'react';
import { useAppStore, useHydrated } from '@/stores/app';

/** Inline script for <head>: applies the saved theme before first paint (no flash). */
export const themeBootScript = `(function(){try{var t='system';var s=null;var raw=localStorage.getItem('transmi-store');if(raw){s=JSON.parse(raw);t=(s.state&&s.state.settings&&s.state.settings.theme)||'system';}else{var d=localStorage.getItem('darkMode');if(d==='true')t='dark';else if(d==='false')t='light';}var dark=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);var h=document.documentElement;h.classList.toggle('dark',dark);var st=s&&s.state&&s.state.settings;if(st){if(st.textSize&&st.textSize!=='normal')h.dataset.text=st.textSize;if(st.highContrast)h.dataset.contrast='more';}}catch(e){}})();`;

/** Keeps the <html> class, text size, contrast and browser theme color in sync with the user's preferences. */
export default function ThemeSync() {
    const hydrated = useHydrated();
    const theme = useAppStore((s) => s.settings.theme);
    const textSize = useAppStore((s) => s.settings.textSize);
    const highContrast = useAppStore((s) => s.settings.highContrast);

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

    useEffect(() => {
        if (!hydrated) return;
        const root = document.documentElement;
        if (textSize === 'normal') delete root.dataset.text;
        else root.dataset.text = textSize;
        if (highContrast) root.dataset.contrast = 'more';
        else delete root.dataset.contrast;
    }, [textSize, highContrast, hydrated]);

    return null;
}
