'use client';

import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { animate, motion, PanInfo, useDragControls, useMotionValue } from 'motion/react';
import { cn } from '@/lib/utils';

interface BottomSheetProps {
    /** Snap heights: values ≤ 1 are fractions of the viewport, larger values are pixels. Ascending. */
    snaps?: number[];
    /** Index into `snaps` */
    snap?: number;
    onSnapChange?: (index: number) => void;
    header?: ReactNode;
    children: ReactNode;
    className?: string;
    /** Extra px reserved at the bottom (e.g. a nav bar) */
    bottomInset?: number;
}

function toPx(value: number, vh: number) {
    return value <= 1 ? value * vh : value;
}

/**
 * Non-modal sheet that sits over a map. Drag the handle (or header) to move
 * between snap points; content scrolls independently.
 */
export default function BottomSheet({
    snaps = [132, 0.5, 0.88],
    snap: controlledSnap,
    onSnapChange,
    header,
    children,
    className,
    bottomInset = 0,
}: BottomSheetProps) {
    const [vh, setVh] = useState(800);
    const [internalSnap, setInternalSnap] = useState(controlledSnap ?? 1);
    const snapIndex = controlledSnap ?? internalSnap;
    const controls = useDragControls();

    useEffect(() => {
        const update = () => setVh(window.innerHeight);
        update();
        window.addEventListener('resize', update);
        return () => window.removeEventListener('resize', update);
    }, []);

    const heights = useMemo(() => snaps.map((s) => Math.round(toPx(s, vh))), [snaps, vh]);
    const maxH = heights[heights.length - 1];
    const y = useMotionValue(maxH - heights[snapIndex]);

    const setSnap = useCallback((i: number) => {
        setInternalSnap(i);
        onSnapChange?.(i);
    }, [onSnapChange]);

    useEffect(() => {
        const controlsAnim = animate(y, maxH - heights[Math.min(snapIndex, heights.length - 1)], { type: 'spring', stiffness: 420, damping: 42 });
        return () => controlsAnim.stop();
    }, [snapIndex, heights, maxH, y]);

    const onDragEnd = (_: unknown, info: PanInfo) => {
        const current = maxH - y.get();
        // Project a bit forward using the release velocity
        const projected = current - info.velocity.y * 0.18;
        let best = 0;
        heights.forEach((h, i) => {
            if (Math.abs(h - projected) < Math.abs(heights[best] - projected)) best = i;
        });
        setSnap(best);
        animate(y, maxH - heights[best], { type: 'spring', stiffness: 420, damping: 42 });
    };

    return (
        <motion.div
            className={cn('absolute left-0 right-0 z-40 flex flex-col rounded-t-[22px] bg-background border-t border-border shadow-[0_-8px_40px_rgba(0,0,0,0.25)]', className)}
            style={{ height: maxH, bottom: bottomInset, y }}
            drag="y"
            dragListener={false}
            dragControls={controls}
            dragConstraints={{ top: 0, bottom: maxH - heights[0] }}
            dragElastic={0.08}
            onDragEnd={onDragEnd}
        >
            <div
                className="shrink-0 touch-none cursor-grab active:cursor-grabbing"
                onPointerDown={(e) => controls.start(e)}
            >
                <button
                    type="button"
                    className="w-full flex justify-center pt-2.5 pb-1.5"
                    aria-label={snapIndex === heights.length - 1 ? 'Reducir panel' : 'Expandir panel'}
                    onClick={() => setSnap(snapIndex === heights.length - 1 ? 1 : Math.min(heights.length - 1, snapIndex + 1))}
                >
                    <span className="w-10 h-1 rounded-full bg-muted-foreground/35" />
                </button>
                {header}
            </div>
            <div
                className="flex-1 overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]"
                style={{ maxHeight: heights[snapIndex] - 40 }}
            >
                {children}
            </div>
        </motion.div>
    );
}
