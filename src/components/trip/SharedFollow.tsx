'use client';

import FollowView from './FollowView';
import LinkProblem from './LinkProblem';
import { useLiveData } from '@/hooks/useLiveData';
import { useClock } from '@/components/plan/useClock';
import type { ShareState, SharedTrip } from '@/lib/tripShare';

/** Live hours of a shared trip; after that the page shows the last known state without polling. */
const LIVE_MS = 6 * 60 * 60 * 1000;

/** A short link (/sigue/:id): the stored trip, plus the sender's reports polled every 15 s. */
export default function SharedFollow({ id, initial }: { id: string; initial: { trip: SharedTrip; state: ShareState } | null }) {
    const now = useClock();
    const live = !!initial && !initial.state.ended && !!now && now - initial.trip.sh * 1000 < LIVE_MS;
    const { data } = useLiveData<{ state: ShareState }>(live ? `/api/sigue/${id}?estado=1` : null, 15000);

    if (!initial) {
        return <LinkProblem title="Este enlace ya no está disponible" text="Los viajes compartidos se borran a los 3 días, o el enlace está incompleto. Pídele a quien te lo envió uno nuevo." />;
    }
    return <FollowView trip={initial.trip} state={data?.state ?? initial.state} />;
}
