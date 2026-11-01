'use client';

import TransMiLogo from '@/components/ui/TransMiLogo';
import SystemStripe from '@/components/brand/SystemStripe';
import { cn } from '@/lib/utils';
import ThemeToggle from './ThemeToggle';

/** Content width on computers; on phones every page is one column. */
const WIDTH = { wide: 'lg:max-w-6xl', narrow: 'lg:max-w-3xl' };

export default function AppHeader({ title, right, className, width = 'wide' }: {
    title?: string;
    right?: React.ReactNode;
    className?: string;
    width?: keyof typeof WIDTH;
}) {
    return (
        // On computers the logo and the theme live in the navigation rail; a header with nothing else goes away
        <header className={cn('sticky top-0 z-40 bg-background/90 backdrop-blur-xl', !title && !right && 'lg:hidden', className)}>
            <div className={cn('flex items-center justify-between max-w-lg mx-auto px-4 h-14 lg:h-20 lg:px-8', WIDTH[width])}>
                <div className="flex items-center gap-2.5 min-w-0">
                    <TransMiLogo size={34} className="lg:hidden" />
                    {title && <h1 className="font-signage text-22 lg:text-34 font-bold text-foreground leading-none truncate">{title}</h1>}
                </div>
                <div className="flex items-center gap-1.5">
                    {right}
                    <ThemeToggle className="lg:hidden" />
                </div>
            </div>
            <SystemStripe className="lg:hidden" />
        </header>
    );
}
