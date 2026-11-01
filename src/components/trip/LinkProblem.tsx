import Link from 'next/link';
import { MapPin } from 'lucide-react';

/** A shared-trip link that can't be shown: unreadable, unknown or expired. */
export default function LinkProblem({ title, text }: { title: string; text: string }) {
    return (
        <div className="min-h-dvh flex flex-col items-center justify-center px-8 text-center">
            <MapPin className="w-10 h-10 mb-4" />
            <h1 className="font-signage text-28 font-bold leading-tight">{title}</h1>
            <p className="mt-2 text-15 text-muted-foreground max-w-xs">{text}</p>
            <Link href="/" className="mt-6 h-12 px-6 rounded-full bg-foreground text-background font-signage text-20 font-bold inline-flex items-center">Abrir TransMi</Link>
        </div>
    );
}
