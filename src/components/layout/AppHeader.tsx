'use client';

import { useEffect, useState } from 'react';
import TransMiLogo from '@/components/ui/TransMiLogo';

function getGreeting(): { text: string; emoji: string } {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return { text: 'Buenos días', emoji: '☀️' };
    if (hour >= 12 && hour < 18) return { text: 'Buenas tardes', emoji: '🌤️' };
    if (hour >= 18 && hour < 21) return { text: 'Buenas noches', emoji: '🌆' };
    return { text: 'Buenas noches', emoji: '🌙' };
}

export default function AppHeader() {
    const [isDark, setIsDark] = useState(false);
    const greeting = getGreeting();

    useEffect(() => {
        const dark = localStorage.getItem('darkMode') === 'true';
        setIsDark(dark);
        if (dark) document.documentElement.classList.add('dark');
    }, []);

    const toggleDark = () => {
        const next = !isDark;
        setIsDark(next);
        document.documentElement.classList.toggle('dark', next);
        localStorage.setItem('darkMode', String(next));
    };

    return (
        <header className="sticky top-0 z-40 bg-background border-b border-border">
            <div className="flex items-center justify-between max-w-lg mx-auto px-4 py-3">
                {/* Logo + Title */}
                <div className="flex items-center gap-2.5">
                    <TransMiLogo size={36} />
                    <div>
                        <h1 className="text-base font-bold text-foreground leading-tight">
                            TransMi
                        </h1>
                        <p className="text-[10px] text-muted-foreground font-medium -mt-0.5">
                            {greeting.text} {greeting.emoji}
                        </p>
                    </div>
                </div>

                {/* Dark mode toggle */}
                <button
                    onClick={toggleDark}
                    className="w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 active:scale-90 bg-secondary hover:bg-accent"
                    aria-label="Toggle dark mode"
                >
                    {isDark ? (
                        <svg className="w-[18px] h-[18px] text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                    ) : (
                        <svg className="w-[18px] h-[18px] text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                        </svg>
                    )}
                </button>
            </div>
        </header>
    );
}
