import { colorForRouteCode, readableOn } from '@/lib/color';
import { cn } from '@/lib/utils';

interface RouteBadgeProps {
    code: string;
    color?: string | null;
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
    className?: string;
    /** Dim when the route is not operating */
    inactive?: boolean;
}

const SIZES = {
    xs: 'h-5 min-w-7 px-1 text-12 rounded-[5px]',
    sm: 'h-6 min-w-9 px-1.5 text-14 rounded-md',
    md: 'h-8 min-w-11 px-2 text-18 rounded-lg',
    lg: 'h-11 min-w-14 px-2.5 text-26 rounded-[10px]',
    xl: 'h-16 min-w-20 px-3.5 text-40 rounded-2xl',
};

/**
 * A route code set like TransMilenio signage: condensed, heavy, on the line's color.
 * Black routes (e.g. "rutas fáciles") get a hairline ring so they read on the dark theme.
 */
export default function RouteBadge({ code, color, size = 'sm', className, inactive }: RouteBadgeProps) {
    const bg = colorForRouteCode(code, color);
    const fg = readableOn(bg);
    const isVeryDark = fg === '#ffffff' && /^#(0{6}|1[0-9a-f]{5}|0[0-9a-f]{5})$/i.test(bg);

    return (
        <span
            className={cn(
                'font-signage inline-flex items-center justify-center font-bold leading-none tabular whitespace-nowrap shrink-0',
                SIZES[size],
                isVeryDark && 'ring-1 ring-inset ring-white/25',
                inactive && 'opacity-40 grayscale',
                className,
            )}
            style={{ backgroundColor: bg, color: fg }}
        >
            {code}
        </span>
    );
}
