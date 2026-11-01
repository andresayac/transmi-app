'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Text that "flips" in character by character like a split-flap departure board
 * whenever its value changes. Respects reduced motion via the global CSS rule.
 */
export default function FlapText({ value, className, stagger = 28 }: { value: string; className?: string; stagger?: number }) {
    const [version, setVersion] = useState(0);
    const prev = useRef(value);

    useEffect(() => {
        if (prev.current !== value) {
            prev.current = value;
            setVersion((v) => v + 1);
        }
    }, [value]);

    return (
        <span className={className} aria-label={value} style={{ perspective: '400px' }}>
            {value.split('').map((ch, i) => (
                <span
                    key={`${version}-${i}`}
                    aria-hidden
                    className="flap-char"
                    style={{ animationDelay: `${i * stagger}ms` }}
                >
                    {ch === ' ' ? ' ' : ch}
                </span>
            ))}
        </span>
    );
}
