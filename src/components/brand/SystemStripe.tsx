import { cn } from '@/lib/utils';

/** The brand signature: a band made of the 15 troncal colors, in letter order. */
export default function SystemStripe({ className, animated = false }: { className?: string; animated?: boolean }) {
    return (
        <div
            aria-hidden
            className={cn('system-stripe h-[3px] w-full', animated && 'motion-safe:animate-[stripeSlide_2.4s_linear_infinite]', className)}
            style={animated ? { backgroundSize: '200% 100%' } : undefined}
        />
    );
}
