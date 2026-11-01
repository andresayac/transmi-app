/**
 * Text that "flips" in character by character like a split-flap departure board
 * whenever its value changes (the keyed span remounts and replays the animation).
 * Respects reduced motion via the global CSS rule.
 */
export default function FlapText({ value, className, stagger = 28 }: { value: string; className?: string; stagger?: number }) {
    return (
        <span key={value} className={className} aria-label={value} style={{ perspective: '400px' }}>
            {value.split('').map((ch, i) => (
                <span
                    key={i}
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
