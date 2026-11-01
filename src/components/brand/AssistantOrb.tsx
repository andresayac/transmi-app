import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * The assistant's mark: a ring spinning through the troncal colors around a
 * black core. Spins faster while the assistant is working.
 */
export default function AssistantOrb({ size = 44, active = false, breathe = false, className, icon = true }: {
    size?: number;
    active?: boolean;
    breathe?: boolean;
    className?: string;
    icon?: boolean;
}) {
    return (
        <span
            className={cn('orb inline-flex items-center justify-center text-white', active && 'orb-active', breathe && 'orb-breathe', className)}
            style={{ width: size, height: size }}
            aria-hidden
        >
            {icon && <Sparkles style={{ width: size * 0.42, height: size * 0.42 }} strokeWidth={2} />}
        </span>
    );
}
