'use client';

import { useMemo } from 'react';
import LineDiagram, { DiagramBus, DiagramStop } from '@/components/transit/LineDiagram';
import type { LiveBus } from '@/types/transit';
import { projectOnPath } from '@/lib/geo';
import type { MapRoute } from './types';
import StopEtaPanel from './StopEtaPanel';

interface Props {
    route: MapRoute;
    buses: LiveBus[];
    selectedIndex: number | null;
    onStopClick: (index: number) => void;
    onCloseStop: () => void;
    onBusClick: (busId: string) => void;
}

/** The route as a strip map with its live buses, plus next arrivals for the selected stop. */
export default function RouteDiagram({ route, buses, selectedIndex, onStopClick, onCloseStop, onBusClick }: Props) {
    const detail = route.detail;

    const stops: DiagramStop[] = useMemo(() => (detail?.stops || []).map((s) => ({
        id: s.id,
        name: s.name,
        sub: s.platform ? `${s.address} · Vagón ${s.platform}` : s.address,
        isPortal: s.isPortal,
        active: s.active,
    })), [detail]);

    const diagramBuses: DiagramBus[] = useMemo(() => {
        const path = detail?.stops || [];
        if (path.length < 2) return [];
        return buses
            .map((b) => {
                const p = projectOnPath({ lat: b.lat, lng: b.lng }, path);
                const bus: DiagramBus = { id: b.id, index: p.index, label: b.label, occupancy: b.occupancy };
                return p.offset < 400 ? bus : null;
            })
            .filter((b): b is DiagramBus => b !== null);
    }, [buses, detail]);

    if (!detail) return null;
    const selectedStop = selectedIndex !== null ? detail.stops[selectedIndex] : null;

    return (
        <div className="space-y-4">
            {selectedStop && (
                <StopEtaPanel
                    key={`${route.key}-${selectedIndex}`}
                    route={{ id: route.id, codigo: route.codigo, nombre: route.nombre, color: route.color }}
                    stop={selectedStop}
                    onClose={onCloseStop}
                />
            )}
            {stops.length === 0 ? (
                <p className="text-14 text-muted-foreground">Esta ruta no tiene paradas publicadas.</p>
            ) : (
                <>
                    {buses.length > 0 && diagramBuses.length < buses.length && (
                        <p className="text-12 text-muted-foreground">
                            {buses.length - diagramBuses.length} bus{buses.length - diagramBuses.length === 1 ? '' : 'es'} fuera del recorrido (en patio o en desvío) solo aparecen en el mapa.
                        </p>
                    )}
                    <LineDiagram
                        color={route.color}
                        stops={stops}
                        buses={diagramBuses}
                        selectedIndex={selectedIndex}
                        onStopClick={onStopClick}
                        onBusClick={(b) => onBusClick(b.id)}
                    />
                </>
            )}
        </div>
    );
}
