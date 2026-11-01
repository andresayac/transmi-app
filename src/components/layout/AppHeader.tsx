'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import TransMiLogo from '@/components/ui/TransMiLogo';
import SystemStripe from '@/components/brand/SystemStripe';
import { ThemePref, useAppStore } from '@/stores/app';
import { cn } from '@/lib/utils';

const NEXT_THEME: Record<ThemePref, ThemePref> = { system: 'dark', dark: 'light', light: 'system' };
const THEME_LABEL: Record<ThemePref, string> = { system: 'Tema del sistema', dark: 'Tema oscuro', light: 'Tema claro' };

export default function AppHeader({ title, right, className }: { title?: string; right?: React.ReactNode; className?: string }) {
    const theme = useAppStore((s) => s.settings.theme);
    const updateSettings = useAppStore((s) => s.updateSettings);
    const ThemeIcon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor;

    return (
        <header className={cn('sticky top-0 z-40 bg-background/90 backdrop-blur-xl', className)}>
            <div className="flex items-center justify-between max-w-lg mx-auto px-4 h-14">
                <div className="flex items-center gap-2.5 min-w-0">
                    <TransMiLogo size={34} />
                    {title && <h1 className="font-signage text-22 font-bold text-foreground leading-none truncate">{title}</h1>}
                </div>
                <div className="flex items-center gap-1.5">
                    {right}
                    <button
                        onClick={() => updateSettings({ theme: NEXT_THEME[theme] })}
                        className="w-9 h-9 rounded-full flex items-center justify-center transition active:scale-90 hover:bg-accent"
                        aria-label={`${THEME_LABEL[theme]}. Cambiar tema`}
                        title={THEME_LABEL[theme]}
                    >
                        <ThemeIcon className="w-[18px] h-[18px] text-foreground" />
                    </button>
                </div>
            </div>
            <SystemStripe />
        </header>
    );
}
