import type { Metadata } from 'next';
import SharedFollow from '@/components/trip/SharedFollow';
import { getSharedTrip } from '@/lib/server/sharedTrips';
import { stopLabel } from '@/components/plan/utils';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }> };

// The preview a messaging app shows for the link: who is going where
export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { id } = await params;
    const shared = await getSharedTrip(id);
    const title = shared
        ? `${shared.trip.by ? `${shared.trip.by} va` : 'Viaje'} hacia ${stopLabel(shared.trip.to[0]).station}`
        : 'Sigue mi viaje';
    const description = 'Mira su bus en vivo y a qué hora llega, en TransMi.';
    return { title, description, openGraph: { title, description, siteName: 'TransMi' }, robots: { index: false, follow: false } };
}

export default async function SharedTripPage({ params }: Props) {
    const { id } = await params;
    return <SharedFollow id={id} initial={await getSharedTrip(id)} />;
}
