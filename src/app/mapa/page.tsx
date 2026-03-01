'use client';


import { useEffect, useRef, useState, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { transmilenioApi } from '@/services/transmilenio';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useToast } from '@/components/ui/Toast';
import { BusLocation } from '@/types/bus';
import { BusETA } from '@/types/explorar';
import { MAPBOX_TOKEN, ROUTE_COLORS, BUS_IMAGES, BUS_POLL_INTERVAL } from '@/utils/constants';
import BottomNav from '@/components/layout/BottomNav';
import CatalogPanel from '@/components/mapa/CatalogPanel';
import StationExplorer from '@/components/mapa/StationExplorer';
import { StationMapEntry } from '@/types/station';

interface MultiRoute {
    id: string;
    codigo: string;
    nombre: string;
    tipoServicio: string;
    color: string;
    originalColor: string;
    data?: Record<string, unknown>;
    visible: boolean;
}

function MapContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const toast = useToast();
    const { latitude, longitude } = useGeolocation();

    const mapContainerRef = useRef<HTMLDivElement>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mapRef = useRef<any>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const markersRef = useRef<any[]>([]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const busMarkersRef = useRef<any[]>([]);
    const busIntervalRef = useRef<NodeJS.Timeout | null>(null);

    const [loading, setLoading] = useState(true);
    const [mapReady, setMapReady] = useState(false);
    const [sheetExpanded, setSheetExpanded] = useState(false);
    const [busCount, setBusCount] = useState(0);
    const [routePanelOpen, setRoutePanelOpen] = useState(false);
    const [catalogOpen, setCatalogOpen] = useState(false);

    // Station explorer state
    const [stations, setStations] = useState<StationMapEntry[]>([]);
    const [selectedStation, setSelectedStation] = useState<StationMapEntry | null>(null);
    const [stationsLoading, setStationsLoading] = useState(false);
    const [stationSearch, setStationSearch] = useState('');
    const [sistemaFilter, setSistemaFilter] = useState<'all' | 'TransMilenio' | 'TransMiZonal'>('all');

    // ETA panel state
    const [etaStation, setEtaStation] = useState<{ nombre: string; codigo: string; routeId: string; routeCodigo: string; routeColor: string } | null>(null);
    const [etaData, setEtaData] = useState<BusETA[]>([]);
    const [etaLoading, setEtaLoading] = useState(false);
    const etaIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Multi-route state
    const isMulti = searchParams.get('multi') === 'true';
    const routeId = searchParams.get('id');
    const routeName = searchParams.get('nombre') || '';
    const routeCode = searchParams.get('codigo') || '';
    const isExplorerMode = !isMulti && !routeId;

    const [routes, setRoutes] = useState<MultiRoute[]>([]);

    // Cleanup
    useEffect(() => {
        return () => {
            if (busIntervalRef.current) clearInterval(busIntervalRef.current);
            markersRef.current.forEach((m) => { try { m.remove(); } catch { } });
            busMarkersRef.current.forEach((m) => { try { m.remove(); } catch { } });
            if (mapRef.current) { try { mapRef.current.remove(); } catch { } }
        };
    }, []);

    // Initialize map — wait for container to have dimensions (SPA navigation fix)
    useEffect(() => {
        if (!mapContainerRef.current || mapRef.current) return;

        const container = mapContainerRef.current;

        const initMap = () => {
            /* eslint-disable @typescript-eslint/no-require-imports */
            const mapboxgl = require('mapbox-gl');
            mapboxgl.accessToken = MAPBOX_TOKEN;

            const map = new mapboxgl.Map({
                container,
                style: 'mapbox://styles/mapbox/dark-v11',
                center: [-74.1, 4.65],
                zoom: 12,
                pitch: 50,
                bearing: -15,
                antialias: true,
            });

            map.addControl(new mapboxgl.NavigationControl({ showCompass: true, visualizePitch: true }), 'top-right');
            map.addControl(new mapboxgl.GeolocateControl({
                positionOptions: { enableHighAccuracy: true },
                trackUserLocation: true,
                showUserHeading: true,
            }), 'top-right');

            map.once('load', () => {
                map.resize();
                setMapReady(true);
            });

            // ResizeObserver fallback: resize map when container dimensions change
            const observer = new ResizeObserver(() => {
                map.resize();
            });
            observer.observe(container);

            mapRef.current = map;

            return () => {
                observer.disconnect();
            };
        };

        // During client-side navigation the container may have 0 dimensions initially.
        // Poll until it has a visible size (up to ~2s), then init the map.
        let attempts = 0;
        const maxAttempts = 20;

        const tryInit = () => {
            const { offsetWidth, offsetHeight } = container;
            if (offsetWidth > 0 && offsetHeight > 0) {
                initMap();
                return;
            }
            attempts++;
            if (attempts < maxAttempts) {
                requestAnimationFrame(tryInit);
            } else {
                // Fallback: initialize anyway after timeout
                initMap();
            }
        };

        // Kick off on the next frame to let layout settle
        requestAnimationFrame(tryInit);
    }, []);

    // Load route data (single or multi)
    useEffect(() => {
        if (isMulti) {
            // Multi-route: read from sessionStorage
            const stored = sessionStorage.getItem('multiRoutes');
            if (!stored) {
                toast.show('No hay rutas seleccionadas', 'error');
                router.back();
                return;
            }
            const selectedRoutes = JSON.parse(stored) as Array<{
                id: string; codigo: string; nombre: string; tipoServicio: string; color: string; originalColor: string;
            }>;

            const loadMulti = async () => {
                setLoading(true);
                const loaded: MultiRoute[] = [];
                for (const r of selectedRoutes) {
                    try {
                        const data = await transmilenioApi.getRouteInfo(r.id, r.nombre, r.codigo);
                        loaded.push({
                            ...r,
                            data,
                            visible: true,
                        });
                    } catch {
                        console.warn(`Failed to load route ${r.codigo}`);
                    }
                }
                setRoutes(loaded);
                setLoading(false);
            };
            loadMulti();
        } else if (routeId && routeName && routeCode) {
            // Single route
            const loadSingle = async () => {
                setLoading(true);
                try {
                    const data = await transmilenioApi.getRouteInfo(routeId, routeName, routeCode);
                    setRoutes([{
                        id: routeId,
                        codigo: routeCode,
                        nombre: routeName,
                        tipoServicio: '',
                        color: ROUTE_COLORS[0],
                        originalColor: ROUTE_COLORS[0],
                        data,
                        visible: true,
                    }]);
                } catch {
                    toast.show('Error al cargar la ruta', 'error');
                } finally {
                    setLoading(false);
                }
            };
            loadSingle();
        } else {
            // Explorer mode: no route selected
            setLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isMulti, routeId, routeName, routeCode]);

    // Load all stations for explorer mode
    useEffect(() => {
        if (!isExplorerMode || !mapReady) return;
        let cancelled = false;
        const loadStations = async () => {
            setStationsLoading(true);
            try {
                const data = await transmilenioApi.getAllEstaciones();
                if (!cancelled) setStations(data);
            } catch (err) {
                console.warn('Failed to load stations:', err);
            }
            if (!cancelled) setStationsLoading(false);
        };
        loadStations();
        return () => { cancelled = true; };
    }, [isExplorerMode, mapReady]);

    // Filtered stations based on sistema filter
    const filteredStations = stations.filter((s) => {
        if (sistemaFilter === 'all') return true;
        return s.sistema === sistemaFilter;
    });

    // Search results (top 8 matches)
    const searchResults = stationSearch.length >= 2
        ? stations
            .filter((s) => s.nombre.toLowerCase().includes(stationSearch.toLowerCase()) ||
                s.codigo.toLowerCase().includes(stationSearch.toLowerCase()))
            .slice(0, 8)
        : [];

    // Fly to nearest station (GPS)
    const flyToNearestStation = useCallback(() => {
        if (!latitude || !longitude || stations.length === 0) {
            toast.show('Activa tu ubicación para buscar la estación más cercana', 'warning');
            return;
        }
        const nearest = stations.reduce((best, s) => {
            const d = (s.lat - latitude) ** 2 + (s.lng - longitude) ** 2;
            return d < best.dist ? { station: s, dist: d } : best;
        }, { station: stations[0], dist: Infinity });

        if (mapRef.current) {
            mapRef.current.flyTo({ center: [nearest.station.lng, nearest.station.lat], zoom: 17, duration: 1500 });
        }
        setSelectedStation(nearest.station);
        setStationSearch('');
    }, [latitude, longitude, stations, toast]);

    // Fly to a specific station (search)
    const flyToStation = useCallback((station: StationMapEntry) => {
        if (mapRef.current) {
            mapRef.current.flyTo({ center: [station.lng, station.lat], zoom: 17, duration: 1200 });
        }
        setSelectedStation(station);
        setStationSearch('');
    }, []);

    // Render stations as GeoJSON layer with clustering
    useEffect(() => {
        if (!mapRef.current || !mapReady || !isExplorerMode) return;
        const map = mapRef.current;

        const sourceId = 'explorer-stations';
        const clusterId = 'explorer-clusters';
        const clusterCountId = 'explorer-cluster-count';
        const layerId = 'explorer-stations-layer';
        const glowLayerId = 'explorer-stations-glow';

        // Clean up previous
        const layerIds = [glowLayerId, layerId, clusterCountId, clusterId];
        layerIds.forEach((id) => { try { if (map.getLayer(id)) map.removeLayer(id); } catch { } });
        try { if (map.getSource(sourceId)) map.removeSource(sourceId); } catch { }

        if (filteredStations.length === 0) return;

        // Compute nearest 5 to GPS
        const nearestIds = new Set<string>();
        if (latitude && longitude) {
            const withDist = filteredStations.map((s) => {
                const dlat = s.lat - latitude;
                const dlng = s.lng - longitude;
                return { id: s.id, dist: dlat * dlat + dlng * dlng };
            });
            withDist.sort((a, b) => a.dist - b.dist);
            withDist.slice(0, 5).forEach((s) => nearestIds.add(s.id));
        }

        const sistemaColor = (s: string) => {
            const lower = s?.toLowerCase() || '';
            if (lower.includes('troncal') || lower === 'transmilenio') return '#e53e3e';
            if (lower.includes('zonal')) return '#3b82f6';
            if (lower.includes('alimenta')) return '#38a169';
            if (lower.includes('sitp')) return '#ed8936';
            return '#6b7280';
        };

        const features = filteredStations.map((s) => ({
            type: 'Feature' as const,
            geometry: { type: 'Point' as const, coordinates: [s.lng, s.lat] },
            properties: {
                id: s.id,
                codigo: s.codigo,
                nombre: s.nombre,
                direccion: s.direccion,
                sistema: s.sistema,
                color: sistemaColor(s.sistema),
                isNearby: nearestIds.has(s.id) ? 1 : 0,
            },
        }));

        map.addSource(sourceId, {
            type: 'geojson',
            data: { type: 'FeatureCollection', features },
            cluster: true,
            clusterMaxZoom: 14,
            clusterRadius: 50,
        });

        // Cluster circles
        map.addLayer({
            id: clusterId,
            type: 'circle',
            source: sourceId,
            filter: ['has', 'point_count'],
            paint: {
                'circle-color': [
                    'step', ['get', 'point_count'],
                    '#a3a3a3',   // < 20: neutral gray
                    20, '#d4d4d4', // 20–100: light gray
                    100, '#fafafa', // 100+: near-white
                ],
                'circle-radius': [
                    'step', ['get', 'point_count'],
                    18,    // < 20
                    20, 24, // 20–100
                    100, 30, // 100+
                ],
                'circle-stroke-color': '#404040',
                'circle-stroke-width': 1.5,
                'circle-opacity': 0.9,
            },
        });

        // Cluster count labels
        map.addLayer({
            id: clusterCountId,
            type: 'symbol',
            source: sourceId,
            filter: ['has', 'point_count'],
            layout: {
                'text-field': '{point_count_abbreviated}',
                'text-size': 12,
                'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
            },
            paint: {
                'text-color': '#171717',
            },
        });

        // Glow ring for nearby stations (unclustered only)
        map.addLayer({
            id: glowLayerId,
            type: 'circle',
            source: sourceId,
            filter: ['all', ['!', ['has', 'point_count']], ['==', ['get', 'isNearby'], 1]],
            paint: {
                'circle-radius': 14,
                'circle-color': '#d4d4d4',
                'circle-opacity': 0.15,
                'circle-blur': 0.8,
            },
        });

        // Individual station dots (unclustered)
        map.addLayer({
            id: layerId,
            type: 'circle',
            source: sourceId,
            filter: ['!', ['has', 'point_count']],
            paint: {
                'circle-radius': [
                    'case',
                    ['==', ['get', 'isNearby'], 1], 8,
                    6,
                ],
                'circle-color': ['get', 'color'],
                'circle-stroke-color': '#ffffff',
                'circle-stroke-width': 2,
            },
        });

        // Click cluster → zoom in
        map.on('click', clusterId, (e: { features?: Array<{ properties: { cluster_id: number } }>; lngLat: { lng: number; lat: number } }) => {
            const feat = e.features?.[0];
            if (!feat) return;
            const clusterId2 = feat.properties.cluster_id;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const src = map.getSource(sourceId) as any;
            src.getClusterExpansionZoom(clusterId2, (err: Error, zoom: number) => {
                if (err) return;
                map.easeTo({ center: e.lngLat, zoom });
            });
        });

        // Click individual station → open panel
        map.on('click', layerId, (e: { features?: Array<{ properties: Record<string, string> }> }) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if (!e.features?.length) return;
            const p = e.features[0].properties;
            const match = stations.find((s) => s.id === p.id);
            if (match) setSelectedStation(match);
        });

        // Hover tooltip
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let popup: any = null;
        map.on('mouseenter', layerId, (e: { features?: Array<{ properties: { nombre: string }; geometry: { coordinates: [number, number] } }> }) => {
            map.getCanvas().style.cursor = 'pointer';
            if (!e.features?.length) return;
            const f = e.features[0];
            const coords = f.geometry.coordinates;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const mapboxgl = (window as any).mapboxgl;
            if (mapboxgl) {
                popup = new mapboxgl.Popup({ closeButton: false, closeOnClick: false, offset: 12, className: 'station-tooltip' })
                    .setLngLat(coords)
                    .setHTML(`<div style="padding:6px 10px;font-size:12px;font-weight:600;color:#fff;background:rgba(17,24,39,0.9);border-radius:8px;white-space:nowrap">${f.properties.nombre}</div>`)
                    .addTo(map);
            }
        });
        map.on('mouseleave', layerId, () => {
            map.getCanvas().style.cursor = '';
            if (popup) { popup.remove(); popup = null; }
        });

        // Cursor on clusters
        map.on('mouseenter', clusterId, () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', clusterId, () => { map.getCanvas().style.cursor = ''; });

        return () => {
            if (popup) { popup.remove(); popup = null; }
            layerIds.forEach((id) => { try { if (map.getLayer(id)) map.removeLayer(id); } catch { } });
            try { if (map.getSource(sourceId)) map.removeSource(sourceId); } catch { }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filteredStations, mapReady, isExplorerMode, latitude, longitude, sistemaFilter]);

    // Render stops on map using GeoJSON circle layers (WebGL, no jitter)
    useEffect(() => {
        if (!mapRef.current || !mapReady) return;
        const map = mapRef.current;

        // If stops should be hidden, remove existing layers and return
        if (!routes.length) {
            routes.forEach((route) => {
                const stopsId = `stops-${route.id}`;
                try { if (map.getLayer(stopsId)) map.removeLayer(stopsId); } catch { }
                try { if (map.getSource(stopsId)) map.removeSource(stopsId); } catch { }
            });
            markersRef.current.forEach((m) => { try { m.remove(); } catch { } });
            markersRef.current = [];
            return;
        }

        /* eslint-disable @typescript-eslint/no-require-imports */
        const mapboxgl = require('mapbox-gl');

        try { map.getContainer(); } catch { return; }

        // Clear old markers (legacy DOM markers)
        markersRef.current.forEach((m) => { try { m.remove(); } catch { } });
        markersRef.current = [];

        // Remove old GeoJSON sources/layers
        routes.forEach((route) => {
            const stopsId = `stops-${route.id}`;
            const portalsId = `portals-${route.id}`;
            try { if (map.getLayer(stopsId)) map.removeLayer(stopsId); } catch { }
            try { if (map.getLayer(portalsId)) map.removeLayer(portalsId); } catch { }
            try { if (map.getSource(stopsId)) map.removeSource(stopsId); } catch { }
        });

        const bounds = new mapboxgl.LngLatBounds();

        // Create a single popup for reuse
        const popup = new mapboxgl.Popup({ offset: 15, maxWidth: '250px', closeButton: true });

        routes.forEach((route) => {
            if (!route.visible || !route.data) return;

            const routeData = Array.isArray(route.data) ? route.data[0] : route.data;
            const recorrido = (routeData as { recorrido?: { data?: Array<{ coordenada: string; nombre: string; direccion: string; codigo: string; tipo_parada: string }> } }).recorrido;
            if (!recorrido?.data) return;

            // Build GeoJSON features
            const features = recorrido.data.map((stop, idx) => {
                const [lat, lng] = stop.coordenada.split(',').map(Number);
                if (isNaN(lat) || isNaN(lng)) return null;
                bounds.extend([lng, lat]);
                return {
                    type: 'Feature' as const,
                    geometry: { type: 'Point' as const, coordinates: [lng, lat] },
                    properties: {
                        nombre: stop.nombre,
                        direccion: stop.direccion,
                        codigo: stop.codigo,
                        tipo_parada: stop.tipo_parada,
                        idx: idx + 1,
                        routeId: route.id,
                        routeCodigo: route.codigo,
                        routeColor: route.color,
                    }
                };
            }).filter(Boolean);

            const stopsId = `stops-${route.id}`;

            // Add GeoJSON source
            map.addSource(stopsId, {
                type: 'geojson',
                data: { type: 'FeatureCollection', features }
            });

            // Regular stops (small circles)
            map.addLayer({
                id: stopsId,
                type: 'circle',
                source: stopsId,
                paint: {
                    'circle-radius': [
                        'case',
                        ['==', ['get', 'tipo_parada'], '3'], 7,
                        5
                    ],
                    'circle-color': [
                        'case',
                        ['==', ['get', 'tipo_parada'], '3'], '#10b981',
                        route.color
                    ],
                    'circle-stroke-color': '#ffffff',
                    'circle-stroke-width': 2,
                }
            });

            // Click handler on stops
            map.on('click', stopsId, (e: { features?: Array<{ properties: Record<string, string>; geometry: { coordinates: [number, number] } }> }) => {
                if (!e.features?.length) return;
                const f = e.features[0];
                const coords = f.geometry.coordinates.slice() as [number, number];
                const p = f.properties;

                popup
                    .setLngLat(coords)
                    .setHTML(`
                        <div style="padding: 12px; font-family: Inter, system-ui, sans-serif;">
                            <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
                                <span style="width:10px;height:10px;border-radius:50%;background:${p.routeColor};display:inline-block;"></span>
                                <span style="font-weight:700;font-size:11px;color:${p.routeColor};">${p.routeCodigo}</span>
                            </div>
                            <h4 style="font-weight: 700; font-size: 13px; margin: 0 0 4px;">${p.nombre}</h4>
                            <p style="font-size: 11px; color: #64748b; margin: 0;">${p.direccion}</p>
                            <p style="font-size: 10px; color: #94a3b8; margin: 4px 0 0;">Parada ${p.idx} · ${p.codigo}</p>
                        </div>
                    `)
                    .addTo(map);

                // Also fetch ETA
                fetchStationETA(p.nombre, p.codigo, p.routeId, p.routeCodigo, p.routeColor);
            });

            // Cursor change on hover
            map.on('mouseenter', stopsId, () => { map.getCanvas().style.cursor = 'pointer'; });
            map.on('mouseleave', stopsId, () => { map.getCanvas().style.cursor = ''; });
        });

        if (!bounds.isEmpty()) {
            try {
                map.fitBounds(bounds, { padding: 60, pitch: 50, bearing: -15 });
            } catch { }
        }
    }, [routes, mapReady]);

    // Load buses for all visible routes
    const loadBuses = useCallback(async () => {
        if (!routes.length || !mapRef.current || !mapReady) return;

        /* eslint-disable @typescript-eslint/no-require-imports */
        const mapboxgl = require('mapbox-gl');
        const map = mapRef.current;

        // Check if route operates today (day only, not hour)
        const isActiveToday = (routeData: unknown): boolean => {
            const rd = routeData as { horarios?: { data?: Array<{ convencion: string }> } };
            const horarios = rd?.horarios?.data;
            if (!horarios?.length) return true; // no schedule info = assume active
            const day = new Date().getDay(); // 0=Sun, 1=Mon ... 6=Sat
            return horarios.some(h => {
                const conv = h.convencion?.toUpperCase().trim() || '';
                if (conv === 'L-S') return day >= 1 && day <= 6;
                if (conv === 'L-V') return day >= 1 && day <= 5;
                if (conv === 'S' || conv === 'SAB' || conv === 'SABADO' || conv === 'SÁBADO') return day === 6;
                if (conv === 'D-F' || conv === 'DOM' || conv === 'DOMINGO' || conv.includes('FESTIV') || conv === 'D' || conv === 'DOM-FES') return day === 0;
                return true; // unknown convention = assume active
            });
        };

        // Remove old bus markers
        const oldMarkers = [...busMarkersRef.current];
        busMarkersRef.current = [];
        let totalBuses = 0;

        for (const route of routes) {
            if (!route.visible || !route.data) continue;

            // Skip bus API call if route doesn't operate today
            const routeData = Array.isArray(route.data) ? route.data[0] : route.data;
            if (!isActiveToday(routeData)) continue;

            try {
                const buses: BusLocation[] = await transmilenioApi.getBusesLocation(route.codigo, route.nombre);
                if (!buses || !Array.isArray(buses)) continue;

                const routeData = Array.isArray(route.data) ? route.data[0] : route.data;
                const routeType = (routeData as Record<string, unknown>)?.tipoServicio as string ||
                    (routeData as Record<string, unknown>)?.tipoRuta as string || '';
                const busImage = BUS_IMAGES[routeType] || 'point_transmi.png';

                buses.forEach((bus: BusLocation) => {
                    const el = document.createElement('div');

                    const icon = document.createElement('div');
                    icon.style.cssText = `
                        width: 40px; height: 40px;
                        border-radius: 50%;
                        border: 4px solid ${route.color};
                        background: url('/assets/img/${busImage}') center/cover;
                        box-shadow: 0 2px 12px rgba(0,0,0,0.4);
                        cursor: pointer;
                        overflow: hidden;
                    `;
                    el.appendChild(icon);

                    // Direction arrow
                    const arrow = document.createElement('div');
                    const radius = 20;
                    const angleRad = ((bus.angulo || 0) - 90) * (Math.PI / 180);
                    const x = radius * Math.cos(angleRad);
                    const y = radius * Math.sin(angleRad);
                    arrow.style.cssText = `
                        position: absolute;
                        width: 0; height: 0;
                        border-left: 6px solid transparent;
                        border-right: 6px solid transparent;
                        border-bottom: 12px solid ${route.color};
                        left: calc(50% + ${x}px);
                        top: calc(50% + ${y}px);
                        transform: translate(-50%, -50%) rotate(${bus.angulo || 0}deg);
                    `;
                    el.appendChild(arrow);

                    const popup = new mapboxgl.Popup({ offset: 25, maxWidth: '220px' })
                        .setHTML(`
                            <div style="padding: 12px; font-family: Inter, system-ui, sans-serif;">
                                <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
                                    <span style="width:10px;height:10px;border-radius:50%;background:${route.color};display:inline-block;"></span>
                                    <span style="font-weight:700;font-size:11px;color:${route.color};">${route.codigo}</span>
                                </div>
                                <h4 style="font-weight: 700; font-size: 13px; margin: 0 0 4px; color: #1e293b;">${bus.label || 'Bus'}</h4>
                                <p style="font-size: 11px; color: #64748b; margin: 0;">Destino: ${bus.destino_limpio || '—'}</p>
                                <p style="font-size: 11px; color: #64748b; margin: 2px 0;">${bus.nombre_sistema || ''}</p>
                                <p style="font-size: 10px; color: #94a3b8; margin: 4px 0 0;">${bus.lasttime || new Date().toLocaleTimeString()}</p>
                            </div>
                        `);

                    const marker = new mapboxgl.Marker({ element: el })
                        .setLngLat([bus.longitude, bus.latitude])
                        .setPopup(popup)
                        .addTo(map);

                    busMarkersRef.current.push(marker);
                });

                totalBuses += buses.length;
            } catch {
                console.warn(`Bus load failed for ${route.codigo}`);
            }
        }

        setBusCount(totalBuses);
        oldMarkers.forEach((m) => { try { m.remove(); } catch { } });
    }, [routes, mapReady]);

    // Start bus tracking
    useEffect(() => {
        if (!routes.length || !mapReady) {
            busMarkersRef.current.forEach((m) => { try { m.remove(); } catch { } });
            busMarkersRef.current = [];
            setBusCount(0);
            return;
        }

        loadBuses();
        busIntervalRef.current = setInterval(loadBuses, BUS_POLL_INTERVAL);

        return () => {
            if (busIntervalRef.current) clearInterval(busIntervalRef.current);
        };
    }, [routes, loadBuses, mapReady]);

    // Toggle route visibility
    const toggleRouteVisibility = (id: string) => {
        setRoutes(prev => prev.map(r => r.id === id ? { ...r, visible: !r.visible } : r));
    };

    // Center on user
    const centerOnUser = () => {
        if (latitude && longitude && mapRef.current) {
            mapRef.current.flyTo({ center: [longitude, latitude], zoom: 15, pitch: 50 });
        }
    };

    // Fetch ETA for a station
    const fetchStationETA = async (nombre: string, codigo: string, routeId: string, routeCodigo: string, routeColor: string) => {
        setEtaStation({ nombre, codigo, routeId, routeCodigo, routeColor });
        setEtaLoading(true);
        setEtaData([]);
        try {
            const data = await transmilenioApi.getServicios(codigo, routeCodigo, routeId, nombre);
            setEtaData(Array.isArray(data) ? data : []);
        } catch { setEtaData([]); }
        setEtaLoading(false);
    };

    // Auto-refresh ETA
    useEffect(() => {
        if (etaIntervalRef.current) clearInterval(etaIntervalRef.current);
        if (etaStation) {
            etaIntervalRef.current = setInterval(() => {
                fetchStationETA(etaStation.nombre, etaStation.codigo, etaStation.routeId, etaStation.routeCodigo, etaStation.routeColor);
            }, 30000);
        }
        return () => { if (etaIntervalRef.current) clearInterval(etaIntervalRef.current); };
    }, [etaStation]);

    const closeETA = () => {
        setEtaStation(null);
        setEtaData([]);
        if (etaIntervalRef.current) clearInterval(etaIntervalRef.current);
    };

    const getETAStatusColor = (estado: string) => {
        const s = estado?.toLowerCase() || '';
        if (s.includes('vacio') || s.includes('vacío')) return 'text-emerald-400';
        if (s.includes('medio')) return 'text-yellow-400';
        if (s.includes('lleno')) return 'text-red-400';
        return 'text-blue-400';
    };

    const getETAEmoji = (estado: string) => {
        const s = estado?.toLowerCase() || '';
        if (s.includes('vacio') || s.includes('vacío')) return '🟢';
        if (s.includes('medio')) return '🟡';
        if (s.includes('lleno')) return '🔴';
        return '🔵';
    };

    // Get combined stops and schedules for bottom sheet
    const getFirstRoute = () => {
        const r = routes[0];
        if (!r?.data) return { recorrido: [], horarios: [] };
        const data = Array.isArray(r.data) ? r.data[0] : r.data;
        type RouteData = { recorrido?: { data?: Array<{ nombre: string; codigo: string; tipo_parada: string }> }; horarios?: { data?: Array<{ convencion: string; hora_inicio: string; hora_fin: string }> } };
        return {
            recorrido: (data as RouteData).recorrido?.data || [],
            horarios: (data as RouteData).horarios?.data || [],
        };
    };

    const { recorrido, horarios } = getFirstRoute();
    const visibleRoutes = routes.filter(r => r.visible);

    const handleCatalogSelect = (selectedRoutes: Array<{ id: string; codigo: string; nombre: string; tipoServicio: string; color: string; originalColor: string }>) => {
        // Store in sessionStorage and navigate to multi-route mode
        sessionStorage.setItem('multiRoutes', JSON.stringify(selectedRoutes));
        setCatalogOpen(false);
        router.push('/mapa?multi=true');
    };

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 30, overflow: 'hidden' }}>
            <div ref={mapContainerRef} style={{ position: 'relative', width: '100%', height: '100%' }} />

            {/* Back button */}
            <button
                onClick={() => router.back()}
                className="absolute top-4 left-4 z-40 w-10 h-10 rounded-xl glass flex items-center justify-center active:scale-90 transition-transform"
            >
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
            </button>

            {/* Route indicator — single mode: badge, multi mode: collapsible panel */}
            {!isMulti ? (
                /* Single route badge */
                <div className="absolute top-4 left-16 z-40 glass rounded-xl px-3 py-2 flex items-center gap-2">
                    <span
                        className="px-2 py-0.5 rounded-lg text-white text-xs font-bold"
                        style={{ backgroundColor: routes[0]?.color || ROUTE_COLORS[0] }}
                    >
                        {routes[0]?.codigo || routeCode}
                    </span>
                    <span className="text-white text-sm font-medium max-w-[160px] truncate">
                        {routes[0]?.nombre || routeName}
                    </span>
                </div>
            ) : (
                /* Multi-route: collapsible pill + expandable panel */
                <div className="absolute top-4 left-16 z-50">
                    {/* Pill trigger */}
                    <button
                        onClick={() => setRoutePanelOpen(v => !v)}
                        className="glass rounded-xl px-3 py-2 flex items-center gap-2 active:scale-95 transition-transform"
                    >
                        {/* Color dots (max 4) */}
                        <div className="flex -space-x-1">
                            {routes.slice(0, 4).map((r) => (
                                <div
                                    key={r.id}
                                    className="w-4 h-4 rounded-full border-2 border-white/30"
                                    style={{ backgroundColor: r.color, opacity: r.visible ? 1 : 0.3 }}
                                />
                            ))}
                        </div>
                        <span className="text-white text-sm font-semibold">
                            {routes.length} rutas
                        </span>
                        <svg className={`w-3 h-3 text-white/60 transition-transform ${routePanelOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>

                    {/* Expandable route panel */}
                    {routePanelOpen && (
                        <div className="mt-2 glass rounded-2xl p-3 w-[260px] max-h-[50vh] overflow-y-auto animate-slide-up">
                            {/* Header with bulk actions */}
                            <div className="flex items-center justify-between mb-2 pb-2 border-b border-white/10">
                                <span className="text-white/60 text-[11px] font-semibold uppercase tracking-wider">
                                    {visibleRoutes.length}/{routes.length} visibles
                                </span>
                                <div className="flex gap-1">
                                    <button
                                        onClick={() => setRoutes(prev => prev.map(r => ({ ...r, visible: true })))}
                                        className="px-2 py-0.5 rounded-md text-[10px] font-semibold text-emerald-400 bg-emerald-400/10 hover:bg-emerald-400/20 transition-colors"
                                    >
                                        Todas
                                    </button>
                                    <button
                                        onClick={() => setRoutes(prev => prev.map(r => ({ ...r, visible: false })))}
                                        className="px-2 py-0.5 rounded-md text-[10px] font-semibold text-red-400 bg-red-400/10 hover:bg-red-400/20 transition-colors"
                                    >
                                        Ninguna
                                    </button>
                                </div>
                            </div>

                            {/* Route list */}
                            <div className="space-y-1">
                                {routes.map((r) => (
                                    <button
                                        key={r.id}
                                        onClick={() => toggleRouteVisibility(r.id)}
                                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-all active:scale-[0.98] ${r.visible
                                            ? 'bg-white/8'
                                            : 'opacity-40'
                                            }`}
                                    >
                                        <span
                                            className="w-3.5 h-3.5 rounded-full flex-shrink-0"
                                            style={{ backgroundColor: r.color }}
                                        />
                                        <span className="text-white text-xs font-bold min-w-[32px] text-left">{r.codigo}</span>
                                        <span className="text-white/50 text-[11px] truncate flex-1 text-left">{r.nombre}</span>
                                        {/* Eye toggle */}
                                        <svg className={`w-4 h-4 flex-shrink-0 ${r.visible ? 'text-white/60' : 'text-white/20'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                            {r.visible ? (
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                            ) : (
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                            )}
                                        </svg>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}


            {/* ETA Panel — floating overlay */}
            {etaStation && (
                <div className="absolute bottom-[130px] left-4 right-4 z-50 glass rounded-2xl p-4 animate-slide-up" style={{ maxHeight: '45vh' }}>
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <div>
                                <h4 className="text-white font-bold text-sm">{etaStation.nombre}</h4>
                                <p className="text-white/50 text-[10px]">{etaStation.codigo} · {etaStation.routeCodigo}
                                    {etaLoading && ' · Actualizando...'}
                                </p>
                            </div>
                        </div>
                        <button onClick={closeETA} className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center active:scale-90 transition-transform">
                            <svg className="w-4 h-4 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    <div className="space-y-1.5 overflow-y-auto" style={{ maxHeight: 'calc(45vh - 80px)' }}>
                        {etaLoading && etaData.length === 0 && (
                            <div className="flex items-center justify-center py-4">
                                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                            </div>
                        )}

                        {!etaLoading && etaData.length === 0 && (
                            <p className="text-white/40 text-center text-xs py-4">Sin buses activos en este momento</p>
                        )}

                        {etaData.map((eta, i) => (
                            <div key={i} className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/5">
                                <span className="text-sm">{getETAEmoji(eta.estadobus)}</span>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 mb-0.5">
                                        <span className={`text-[11px] font-semibold ${getETAStatusColor(eta.estadobus)}`}>{eta.estadobus}</span>
                                        <span className="text-white/30 text-[10px]">·</span>
                                        <span className="text-white/50 text-[10px]">{eta.etiqueta}</span>
                                    </div>
                                    <p className="text-white text-xs font-bold truncate">
                                        {eta.labeltiempo || `${eta.time} min`}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-white/40 text-[10px]">{eta.destino_limpio}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Station Explorer panel */}
            {isExplorerMode && selectedStation && (
                <StationExplorer
                    station={selectedStation}
                    onClose={() => setSelectedStation(null)}
                />
            )}

            {/* Stations loading indicator */}
            {isExplorerMode && stationsLoading && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 glass rounded-xl px-4 py-2 flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    <span className="text-white text-xs font-medium">Cargando estaciones...</span>
                </div>
            )}

            {/* Loading overlay (route modes only) */}
            {loading && !isExplorerMode && (
                <div className="absolute inset-0 z-50 bg-black/50 flex items-center justify-center">
                    <div className="glass rounded-2xl px-8 py-6 flex flex-col items-center gap-3">
                        <div className="w-8 h-8 border-3 border-white/20 border-t-white rounded-full animate-spin" />
                        <p className="text-white text-sm font-medium">
                            {isMulti ? `Cargando ${routes.length > 0 ? routes.length : ''} rutas...` : 'Cargando ruta...'}
                        </p>
                    </div>
                </div>
            )}

            {/* Catalog FAB button */}
            {!catalogOpen && (
                <button
                    onClick={() => setCatalogOpen(true)}
                    className="absolute bottom-[140px] right-4 z-40 w-12 h-12 rounded-2xl glass flex items-center justify-center active:scale-90 transition-transform shadow-lg"
                    title="Catálogo de rutas"
                >
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
                    </svg>
                </button>
            )}

            {/* Catalog Panel */}
            {catalogOpen && (
                <CatalogPanel
                    onSelectRoutes={handleCatalogSelect}
                    onClose={() => setCatalogOpen(false)}
                />
            )}

            {/* Click backdrop to close route panel */}
            {routePanelOpen && (
                <div
                    className="absolute inset-0 z-45"
                    onClick={() => setRoutePanelOpen(false)}
                />
            )}

            {/* Bottom Sheet — route modes: schedules; explorer mode: info bar */}
            {isExplorerMode ? (
                /* Explorer mode: search + GPS + filters */
                <div className="absolute bottom-0 left-0 right-0 z-40 bg-background border-t border-border rounded-t-2xl pb-[env(safe-area-inset-bottom)]">
                    {/* Search results dropdown */}
                    {searchResults.length > 0 && (
                        <div className="px-4 pb-1 max-h-[200px] overflow-y-auto border-b border-border">
                            {searchResults.map((s) => (
                                <button
                                    key={s.id}
                                    onClick={() => flyToStation(s)}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-accent active:bg-accent transition-colors text-left"
                                >
                                    <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${s.sistema === 'TransMilenio' ? 'bg-foreground' : 'bg-muted-foreground'
                                        }`} />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-foreground text-xs font-semibold truncate">{s.nombre}</p>
                                        <p className="text-muted-foreground text-[10px]">{s.direccion}</p>
                                    </div>
                                    <span className="text-muted-foreground/50 text-[10px] flex-shrink-0">{s.codigo}</span>
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Search + GPS row */}
                    <div className="px-4 pt-3 pb-2 flex items-center gap-2">
                        <div className="flex-1 relative">
                            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                            </svg>
                            <input
                                type="text"
                                value={stationSearch}
                                onChange={(e) => setStationSearch(e.target.value)}
                                placeholder="Buscar estación..."
                                className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-secondary text-foreground text-sm placeholder:text-muted-foreground border border-border focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
                            />
                            {stationSearch && (
                                <button
                                    onClick={() => setStationSearch('')}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-muted flex items-center justify-center"
                                >
                                    <svg className="w-3 h-3 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            )}
                        </div>
                        <button
                            onClick={flyToNearestStation}
                            disabled={stationsLoading}
                            className="w-11 h-11 rounded-xl bg-secondary flex items-center justify-center active:scale-90 transition-transform flex-shrink-0 border border-border"
                            title="Estación más cercana"
                        >
                            <svg className="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
                            </svg>
                        </button>
                    </div>

                    {/* Filter chips + station count */}
                    <div className="px-4 pb-3 flex items-center gap-2">
                        {(['all', 'TransMilenio', 'TransMiZonal'] as const).map((f) => {
                            const label = f === 'all' ? 'Todas' : f === 'TransMilenio' ? 'TM' : 'Zonal';
                            const isActive = sistemaFilter === f;
                            return (
                                <button
                                    key={f}
                                    onClick={() => setSistemaFilter(f)}
                                    className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${isActive
                                        ? 'bg-foreground text-background shadow-sm'
                                        : 'bg-secondary text-muted-foreground hover:text-foreground'
                                        }`}
                                >
                                    {label}
                                </button>
                            );
                        })}
                        <span className="text-muted-foreground/50 text-[10px] ml-auto">
                            {stationsLoading ? '...' : `${filteredStations.length} estaciones`}
                        </span>
                    </div>
                </div>
            ) : (
                <div
                    className={`absolute bottom-0 left-0 right-0 z-40 bottom-sheet bg-background border-t border-border rounded-t-2xl transition-transform pb-[env(safe-area-inset-bottom)] ${sheetExpanded ? 'translate-y-0' : 'translate-y-[calc(100%-120px)]'
                        }`}
                    style={{ maxHeight: '60vh' }}
                >
                    {/* Handle */}
                    <button
                        onClick={() => setSheetExpanded((v) => !v)}
                        className="w-full flex justify-center py-3 cursor-pointer"
                    >
                        <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
                    </button>

                    <div className="px-5 pb-6 overflow-y-auto" style={{ maxHeight: 'calc(60vh - 48px)' }}>
                        {isMulti && routes.length > 1 ? (
                            /* Multi-route: compact route list with schedules */
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                                        {visibleRoutes.length} de {routes.length} rutas · {busCount} buses
                                    </h4>
                                </div>

                                {routes.filter(r => r.visible).map((route) => {
                                    const rd = Array.isArray(route.data) ? route.data[0] : route.data;
                                    type RouteScheduleData = {
                                        recorrido?: { data?: Array<{ nombre: string }> };
                                        horarios?: { data?: Array<{ convencion: string; hora_inicio: string; hora_fin: string }> };
                                    };
                                    const rd2 = rd as RouteScheduleData;
                                    const stopsCount = rd2?.recorrido?.data?.length || 0;
                                    const horarios = rd2?.horarios?.data || [];

                                    return (
                                        <div key={route.id} className="bg-secondary rounded-xl p-3">
                                            <div className="flex items-center gap-2 mb-1.5">
                                                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: route.color }} />
                                                <span className="text-foreground text-sm font-bold">{route.codigo}</span>
                                                <span className="text-muted-foreground text-xs truncate flex-1">{route.nombre}</span>
                                                <span className="text-muted-foreground/50 text-[10px]">{stopsCount} paradas</span>
                                            </div>
                                            {horarios.length > 0 && (
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                    {horarios.map((h, i) => (
                                                        <span key={i} className="px-2 py-0.5 rounded-md text-[10px] font-semibold" style={{ backgroundColor: `${route.color}20`, color: route.color }}>
                                                            {h.convencion}: {h.hora_inicio} - {h.hora_fin}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            /* Single route: info + schedule only */
                            <>
                                <div className="flex items-center gap-3 mb-4">
                                    <span
                                        className="px-3 py-1.5 rounded-xl text-white font-bold text-sm"
                                        style={{ backgroundColor: routes[0]?.color || ROUTE_COLORS[0] }}
                                    >
                                        {routes[0]?.codigo || routeCode}
                                    </span>
                                    <div>
                                        <h3 className="text-foreground font-bold text-base">{routes[0]?.nombre || routeName}</h3>
                                        <p className="text-muted-foreground text-xs">{recorrido.length} paradas · {busCount} buses activos</p>
                                    </div>
                                </div>

                                {horarios.length > 0 && (
                                    <div className="mb-3">
                                        <h4 className="text-muted-foreground text-xs font-semibold uppercase tracking-wider mb-2">Horarios</h4>
                                        <div className="flex flex-wrap gap-1.5">
                                            {horarios.map((h, i) => (
                                                <span key={i} className="px-2.5 py-1 rounded-lg bg-red-500/15 text-red-400 text-[11px] font-semibold">
                                                    {h.convencion}: {h.hora_inicio} - {h.hora_fin}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default function MapPage() {
    return (
        <Suspense
            fallback={
                <div className="fixed inset-0 bg-[var(--color-bg)] flex items-center justify-center">
                    <div className="w-8 h-8 border-3 border-white/20 border-t-white rounded-full animate-spin" />
                </div>
            }
        >
            <MapContent />
        </Suspense>
    );
}
