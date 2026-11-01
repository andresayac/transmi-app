'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Round glass button for floating map controls. */
export function MapButton({ label, onClick, active, children, className, disabled }: {
    label: string;
    onClick?: () => void;
    active?: boolean;
    children: ReactNode;
    className?: string;
    disabled?: boolean;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            aria-label={label}
            title={label}
            aria-pressed={active}
            className={cn(
                'w-11 h-11 rounded-full flex items-center justify-center shadow-lg transition active:scale-90 disabled:opacity-50',
                active ? 'bg-foreground text-background' : 'glass text-foreground',
                className,
            )}
        >
            {children}
        </button>
    );
}

/** Right-hand column of controls, below the safe area. */
export function MapControlColumn({ children }: { children: ReactNode }) {
    return (
        <div className="absolute right-3 z-40 flex flex-col gap-2" style={{ top: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}>
            {children}
        </div>
    );
}
