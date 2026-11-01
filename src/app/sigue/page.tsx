'use client';

import { useMemo, useSyncExternalStore } from 'react';
import FollowView from '@/components/trip/FollowView';
import LinkProblem from '@/components/trip/LinkProblem';
import { unpackTrip } from '@/lib/tripShare';

function subscribeHash(onChange: () => void) {
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
}

/** Links that carry the whole trip after the # (made when a short link couldn't be created). */
export default function SiguePage() {
    const hash = useSyncExternalStore(subscribeHash, () => window.location.hash, () => '');
    const trip = useMemo(() => (hash.length > 1 ? unpackTrip(hash.slice(1)) : null), [hash]);

    if (!hash) {
        return <div className="min-h-dvh flex items-center justify-center"><div className="w-40 h-[3px] rounded-full system-stripe" /></div>;
    }
    if (!trip) return <LinkProblem title="Este enlace no se puede leer" text="Puede que se haya cortado al copiarlo. Pídele a quien te lo envió que lo comparta de nuevo." />;
    return <FollowView trip={trip} />;
}
