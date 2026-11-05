'use client';

import { cn } from '@/lib/utils';

/** A row of mutually exclusive options (theme, text size, which app you use…). */
export default function Segmented<T extends string>({ value, options, onChange, label, className }: {
    value: T;
    options: { value: T; label: string }[];
    onChange: (v: T) => void;
    label: string;
    className?: string;
}) {
    return (
        <div role="radiogroup" aria-label={label} className={cn('inline-grid grid-flow-col auto-cols-fr p-1 rounded-xl bg-secondary', className)}>
            {options.map((o) => (
                <button
                    key={o.value}
                    role="radio"
                    aria-checked={value === o.value}
                    onClick={() => onChange(o.value)}
                    className={cn('h-8 px-3 rounded-lg text-13 font-semibold transition', value === o.value ? 'bg-background shadow-sm' : 'text-muted-foreground')}
                >
                    {o.label}
                </button>
            ))}
        </div>
    );
}
