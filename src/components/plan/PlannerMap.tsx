'use client';

import { useEffect } from 'react';
import { MapPin } from 'lucide-react';
import type { Itinerary, PlanPlace } from '@/types/transit';
import { useAppStore } from '@/stores/app';
import { useDataSaver } from '@/lib/dataSaver';
import { BOGOTA_CENTER } from '@/utils/constants';
import { useMapInstance } from '@/components/mapa/useMapInstance';
import ItineraryMap from './ItineraryMap';

interface PlannerMapProps {
    /** The option shown: the one open, or the one pointed at in the list */
    itinerary: Itinerary | null;
    from: PlanPlace | null;
    to: PlanPlace | null;
}

/** Computer planner: the map beside the options. */
export default function PlannerMap({ itinerary, from, to }: PlannerMapProps) {
    if (itinerary && from && to) {
        return <ItineraryMap itinerary={itinerary} from={from} to={to} padding={{ top: 90, bottom: 90, left: 90, right: 90 }} />;
    }
    return <WaitingMap focus={to ?? from} />;
}

/** Before there's an option: Bogotá, moving to the destination (or the start) once chosen. */
function WaitingMap({ focus }: { focus: PlanPlace | null }) {
    const saving = useDataSaver();
    if (saving) {
        return (
            <div className="w-full h-full bg-secondary flex flex-col items-center justify-center gap-2 text-center px-8">
                <MapPin className="w-6 h-6 text-muted-foreground" />
                <p className="text-14 text-muted-foreground max-w-[32ch]">Con el ahorro de datos, la ruta se dibuja aquí cuando elijas una opción.</p>
            </div>
        );
    }
    return <BaseMap focus={focus} />;
}

function BaseMap({ focus }: { focus: PlanPlace | null }) {
    const light = useAppStore((s) => s.settings.mapLight);
    const { containerRef, map, ready } = useMapInstance({ center: BOGOTA_CENTER, zoom: 11.3, light });

    const lat = focus?.lat;
    const lng = focus?.lng;
    useEffect(() => {
        if (!map || !ready || lat === undefined || lng === undefined) return;
        map.flyTo({ center: [lng, lat], zoom: 14, duration: 1200 });
    }, [map, ready, lat, lng]);

    // Inline position: mapbox-gl.css sets .mapboxgl-map { position: relative }
    return <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} className="bg-secondary" aria-label="Mapa" role="img" />;
}
