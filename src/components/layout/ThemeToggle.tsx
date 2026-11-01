'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { ThemePref, useAppStore } from '@/stores/app';
import { cn } from '@/lib/utils';

const NEXT_THEME: Record<ThemePref, ThemePref> = { system: 'dark', dark: 'light', light: 'system' };
const THEME_LABEL: Record<ThemePref, string> = { system: 'Tema del sistema', dark: 'Tema oscuro', light: 'Tema claro' };

/** Cycles system → dark → light. */
export default function ThemeToggle({ className }: { className?: string }) {
    const theme = useAppStore((s) => s.settings.theme);
    const updateSettings = useAppStore((s) => s.updateSettings);
    const ThemeIcon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor;

    return (
        <button
            onClick={() => updateSettings({ theme: NEXT_THEME[theme] })}
            className={cn('w-9 h-9 rounded-full flex items-center justify-center transition active:scale-90 hover:bg-accent', className)}
            aria-label={`${THEME_LABEL[theme]}. Cambiar tema`}
            title={THEME_LABEL[theme]}
        >
            <ThemeIcon className="w-[18px] h-[18px] text-foreground" />
        </button>
    );
}
