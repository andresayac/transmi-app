'use client';

import { Suspense, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, CreditCard, IdCard, Layers, Library, LocateFixed, Moon, Sun, SunMoon, X } from 'lucide-react';
import { useAppStore, useHydrated } from '@/stores/app';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useToast } from '@/components/ui/Toast';
import { isDarkPreset, lightPresetFor, MapLightPref, setMapLight } from '@/lib/mapbox';
import { BOGOTA_CENTER } from '@/utils/constants';
import { useMapInstance } from '@/components/mapa/useMapInstance';
import { useUserDot } from '@/components/mapa/useUserDot';
import { MapButton, MapControlColumn } from '@/components/mapa/MapControls';
import RoutesMode from '@/components/mapa/RoutesMode';
import ExplorerMode from '@/components/mapa/ExplorerMode';
import CatalogPanel from '@/components/mapa/CatalogPanel';
import type { ServiceLayerKind, ServiceLayers, StoredMultiRoute } from '@/components/mapa/types';
import { cn } from '@/lib/utils';

const NEXT_LIGHT: Record<MapLightPref, MapLightPref> = { auto: 'day', day: 'night', night: 'auto' };
const LIGHT_LABEL: Record<MapLightPref, string> = {
    auto: 'Luz del mapa: según la hora en Bogotá',
    day: 'Luz del mapa: siempre de día',
    night: 'Luz del mapa: siempre de noche',
};

const noopSubscribe = () => () => {};
const readMultiRoutes = () => sessionStorage.getItem('multiRoutes');
const serverMultiRoutes = () => null;

function num(v: string | null): number | null {
    if (v === null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
}

function MapScreen() {
    const params = useSearchParams();
    const router = useRouter();
    const toast = useToast();
    useHydrated();

    const isMulti = params.get('multi') === 'true';
    const routeId = params.get('id');
    const routeCode = params.get('codigo');
    const routeName = params.get('nombre') || '';
    const mode: 'single' | 'multi' | 'explorer' = isMulti ? 'multi' : routeId && routeCode ? 'single' : 'explorer';
    const capa = params.get('capa');
    const estacion = params.get('estacion');

    // Initial camera from ?lat=&lng=&zoom=
    const lat = num(params.get('lat')), lng = num(params.get('lng'));
    const initialCenter: [number, number] = lat !== null && lng !== null ? [lng, lat] : BOGOTA_CENTER;
    const initialZoom = num(params.get('zoom')) ?? (lat !== null ? 15 : 12);

    const mapLight = useAppStore((s) => s.settings.mapLight);
    const updateSettings = useAppStore((s) => s.updateSettings);
    const { containerRef, map, ready } = useMapInstance({ center: initialCenter, zoom: initialZoom, light: mapLight });
    const darkPreset = useMemo(() => isDarkPreset(lightPresetFor(mapLight)), [mapLight]);

    useEffect(() => {
        if (map && ready) setMapLight(map, mapLight);
    }, [map, ready, mapLight]);

    const geo = useGeolocation({ watch: true });
    useUserDot(map, geo.latitude, geo.longitude);

    // Service layers (explorer), optionally pre-enabled with ?capa=recarga|personalizacion
    const [layers, setLayers] = useState<ServiceLayers>(() => ({ recarga: capa === 'recarga', personalizacion: capa === 'personalizacion' }));
    const [layersOpen, setLayersOpen] = useState(false);
    const [catalogOpen, setCatalogOpen] = useState(false);

    // ?capa=: center on the rider once we know where they are (else Bogotá stays in view)
    const capaCentered = useRef(false);
    useEffect(() => {
        if (!capa || capaCentered.current || !map || !ready || mode !== 'explorer') return;
        if (geo.latitude === null || geo.longitude === null) return;
        capaCentered.current = true;
        map.flyTo({ center: [geo.longitude, geo.latitude], zoom: 15, duration: 1200 });
    }, [capa, map, ready, mode, geo.latitude, geo.longitude]);

    // Comparison routes come from sessionStorage (client only)
    const storedMulti = useSyncExternalStore(noopSubscribe, readMultiRoutes, serverMultiRoutes);
    const multiRoutes = useMemo<StoredMultiRoute[] | null>(() => {
        if (!storedMulti) return null;
        try {
            const parsed = JSON.parse(storedMulti) as StoredMultiRoute[];
            return Array.isArray(parsed) && parsed.length ? parsed : null;
        } catch {
            return null;
        }
    }, [storedMulti]);

    const singleRoute = useMemo<StoredMultiRoute[]>(
        () => (routeId && routeCode ? [{ id: routeId, codigo: routeCode, nombre: routeName, tipoServicio: '', color: '', originalColor: '' }] : []),
        [routeId, routeCode, routeName],
    );

    const goBack = () => {
        if (window.history.length > 1) router.back();
        else router.push('/');
    };

    const locate = () => {
        if (geo.latitude !== null && geo.longitude !== null) {
            map?.flyTo({ center: [geo.longitude, geo.latitude], zoom: Math.max(map.getZoom(), 15), duration: 1000 });
        } else {
            geo.requestLocation();
            toast.show(geo.error || 'Buscando tu ubicación…', geo.error ? 'warning' : 'info');
        }
    };

    const LightIcon = mapLight === 'day' ? Sun : mapLight === 'night' ? Moon : SunMoon;
    const toggleLayer = (k: ServiceLayerKind) => setLayers((prev) => ({ ...prev, [k]: !prev[k] }));
    const anyLayer = layers.recarga || layers.personalizacion;

    return (
        <div className="fixed inset-0 z-30 overflow-hidden bg-background">
            {/* Inline position: mapbox-gl.css (unlayered) sets .mapboxgl-map { position: relative }, which beats Tailwind's layered `absolute` */}
            <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} aria-label="Mapa" />

            {!ready && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-background" aria-hidden>
                    <div className="w-40 h-[3px] rounded-full overflow-hidden bg-secondary">
                        <div className="h-full w-full system-stripe" style={{ backgroundSize: '200% 100%', animation: 'stripeSlide 1.6s linear infinite' }} />
                    </div>
                </div>
            )}

            {/* Back */}
            <div className="absolute left-3 z-40" style={{ top: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}>
                <MapButton label="Volver" onClick={goBack}>
                    <ArrowLeft className="w-5 h-5" />
                </MapButton>
            </div>

            <MapControlColumn>
                <MapButton label="Ir a mi ubicación" onClick={locate}>
                    <LocateFixed className={cn('w-5 h-5', geo.loading && 'animate-pulse')} />
                </MapButton>
                <MapButton label={LIGHT_LABEL[mapLight]} onClick={() => updateSettings({ mapLight: NEXT_LIGHT[mapLight] })}>
                    <LightIcon className="w-5 h-5" />
                </MapButton>
                {mode === 'explorer' && (
                    <MapButton label="Capas del mapa" onClick={() => setLayersOpen((v) => !v)} active={layersOpen || anyLayer}>
                        <Layers className="w-5 h-5" />
                    </MapButton>
                )}
                <MapButton label="Catálogo de rutas" onClick={() => setCatalogOpen(true)}>
                    <Library className="w-5 h-5" />
                </MapButton>
            </MapControlColumn>

            {/* Layers menu */}
            {mode === 'explorer' && layersOpen && (
                <>
                    <div className="absolute inset-0 z-40" onClick={() => setLayersOpen(false)} aria-hidden />
                    <div
                        className="absolute right-16 z-50 w-[260px] rounded-2xl bg-background border border-border shadow-2xl p-2 animate-slide-up"
                        style={{ top: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}
                        role="dialog"
                        aria-label="Capas del mapa"
                    >
                        <div className="flex items-center justify-between px-2 py-1">
                            <span className="font-signage text-18 font-bold">Capas</span>
                            <button onClick={() => setLayersOpen(false)} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-accent" aria-label="Cerrar capas">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <LayerToggle
                            icon={<CreditCard className="w-5 h-5" />}
                            title="Puntos de recarga TuLlave"
                            subtitle="Tiendas y droguerías que recargan"
                            checked={layers.recarga}
                            onChange={() => toggleLayer('recarga')}
                        />
                        <LayerToggle
                            icon={<IdCard className="w-5 h-5" />}
                            title="Puntos de personalización"
                            subtitle="Para registrar tu tarjeta a tu nombre"
                            checked={layers.personalizacion}
                            onChange={() => toggleLayer('personalizacion')}
                        />
                    </div>
                </>
            )}

            {mode === 'explorer' && (
                <ExplorerMode
                    map={map}
                    ready={ready}
                    darkPreset={darkPreset}
                    layers={layers}
                    userLat={geo.latitude}
                    userLng={geo.longitude}
                    onRequestLocation={geo.requestLocation}
                    initialStation={estacion}
                />
            )}

            {mode === 'single' && (
                <RoutesMode key={`single-${routeId}-${routeCode}`} map={map} ready={ready} darkPreset={darkPreset} multi={false} initial={singleRoute} />
            )}

            {mode === 'multi' && multiRoutes && (
                <RoutesMode key={`multi-${storedMulti}`} map={map} ready={ready} darkPreset={darkPreset} multi initial={multiRoutes} />
            )}

            {mode === 'multi' && !multiRoutes && (
                <div className="absolute left-3 right-3 bottom-[calc(env(safe-area-inset-bottom)+16px)] z-40 rounded-2xl bg-background border border-border p-4 shadow-2xl">
                    <p className="font-signage text-20 font-bold">No hay rutas para comparar</p>
                    <p className="text-14 text-muted-foreground mt-0.5">Elige varias rutas en Explorar, en una estación o en el catálogo y vuelve a abrir la comparación.</p>
                    <div className="mt-3 flex gap-2">
                        <Link href="/explorar" className="h-10 px-4 rounded-full bg-foreground text-background flex items-center text-14 font-semibold">Ir a Explorar</Link>
                        <button onClick={() => setCatalogOpen(true)} className="h-10 px-4 rounded-full border border-border text-14 font-semibold">Abrir catálogo</button>
                    </div>
                </div>
            )}

            {catalogOpen && (
                <CatalogPanel
                    onClose={() => setCatalogOpen(false)}
                    onSelectRoutes={(routes) => {
                        sessionStorage.setItem('multiRoutes', JSON.stringify(routes));
                        setCatalogOpen(false);
                        router.push(`/mapa?multi=true&t=${routes.map((r) => r.id).join('-')}`);
                    }}
                />
            )}
        </div>
    );
}

function LayerToggle({ icon, title, subtitle, checked, onChange }: { icon: React.ReactNode; title: string; subtitle: string; checked: boolean; onChange: () => void }) {
    return (
        <button
            onClick={onChange}
            role="switch"
            aria-checked={checked}
            className="w-full flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-accent text-left"
        >
            <span className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', checked ? 'bg-foreground text-background' : 'bg-secondary')}>{icon}</span>
            <span className="flex-1 min-w-0">
                <span className="block text-14 font-semibold leading-tight">{title}</span>
                <span className="block text-12 text-muted-foreground leading-tight mt-0.5">{subtitle}</span>
            </span>
            <span className={cn('w-10 h-6 rounded-full p-0.5 transition shrink-0', checked ? 'bg-foreground' : 'bg-secondary border border-border')}>
                <span className={cn('block w-5 h-5 rounded-full transition-transform', checked ? 'translate-x-4 bg-background' : 'bg-muted-foreground/60')} />
            </span>
        </button>
    );
}

export default function MapPage() {
    return (
        <Suspense fallback={<div className="fixed inset-0 bg-background" />}>
            <MapScreen />
        </Suspense>
    );
}
