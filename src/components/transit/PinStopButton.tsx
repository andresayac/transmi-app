'use client';

import { Pin, PinOff } from 'lucide-react';
import { useAppStore, useHydrated, type PinnedStop } from '@/stores/app';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/utils';

/** Pin a station or stop to the home screen to see its arrivals every day. */
export default function PinStopButton({ stop, variant = 'icon', className }: { stop: PinnedStop; variant?: 'icon' | 'pill'; className?: string }) {
    const hydrated = useHydrated();
    const pinned = useAppStore((s) => s.pinnedStops.some((p) => p.codigo === stop.codigo));
    const count = useAppStore((s) => s.pinnedStops.length);
    const pin = useAppStore((s) => s.pinStop);
    const unpin = useAppStore((s) => s.unpinStop);
    const toast = useToast();
    if (!hydrated) return null;

    const toggle = () => {
        if (pinned) {
            unpin(stop.codigo);
            toast.show(`${stop.nombre} ya no está en tu inicio`, 'info');
        } else {
            pin(stop);
            toast.show(count >= 4 ? `${stop.nombre} fijada (reemplaza la más antigua)` : `${stop.nombre} fijada en tu inicio`, 'success');
        }
    };

    const Icon = pinned ? PinOff : Pin;
    const label = pinned ? 'Quitar del inicio' : 'Fijar en inicio';

    if (variant === 'pill') {
        return (
            <button
                type="button"
                onClick={toggle}
                aria-pressed={pinned}
                className={cn('inline-flex items-center justify-center gap-2 h-11 px-4 rounded-xl border font-semibold text-14 active:scale-[0.98] transition', pinned ? 'border-foreground' : 'border-border hover:bg-accent', className)}
            >
                <Icon className="w-4 h-4" /> {label}
            </button>
        );
    }

    return (
        <button
            type="button"
            onClick={toggle}
            aria-pressed={pinned}
            aria-label={`${label}: ${stop.nombre}`}
            title={label}
            className={cn('w-10 h-10 rounded-full border flex items-center justify-center active:scale-90 transition', pinned ? 'bg-foreground text-background border-foreground' : 'border-border hover:bg-accent', className)}
        >
            <Pin className={cn('w-[18px] h-[18px]', pinned && 'fill-current')} />
        </button>
    );
}
