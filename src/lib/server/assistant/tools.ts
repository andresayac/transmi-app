import 'server-only';

import { z } from 'zod/v4';
import {
    findStations,
    getArrivals,
    getFare,
    getLiveBuses,
    getRouteDetail,
    getWeather,
    nearestServicePoints,
    nearestStations,
    planTrip,
    searchPlaces,
    searchRoutes,
} from '@/lib/server/transit';
import { formatDistance } from '@/lib/geo';
import { bogotaNow, isActiveNow } from '@/lib/schedule';
import type { AssistantContext, AssistantEvent } from '@/components/assistant/types';
import type { Itinerary, PlanPlace } from '@/types/transit';

type Emit = (event: AssistantEvent) => void;

const coord = (min: number, max: number, what: string) => z.number().min(min).max(max).describe(what);
const lat = coord(3.9, 5.4, 'Latitud (Bogotá ≈ 4.45 a 4.85)');
const lng = coord(-74.6, -73.6, 'Longitud (Bogotá ≈ -74.25 a -73.98)');

const placeSchema = z.object({
    nombre: z.string().min(1).max(160).describe('Nombre legible del lugar, p. ej. "Movistar Arena" o "Casa"'),
    lat,
    lng,
});

const json = (value: unknown) => JSON.stringify(value);

/**
 * A tool the model can call: its Zod schema becomes the JSON Schema in the request's
 * `tools` array, and the same schema validates the arguments the model sends back.
 */
export interface ToolDef<S extends z.ZodType = z.ZodType> {
    name: string;
    description: string;
    inputSchema: S;
    /** callId is the provider's tool-call id, used to pair UI status rows */
    run: (input: z.infer<S>, callId?: string) => Promise<string>;
}

function defineTool<S extends z.ZodType>(def: ToolDef<S>): ToolDef<S> {
    return def;
}

/** Runs a tool body while streaming start/done/error status rows to the UI. */
async function track(emit: Emit, name: string, label: string, callId: string | undefined, body: () => Promise<string>): Promise<string> {
    const id = callId || Math.random().toString(36).slice(2);
    emit({ type: 'tool', id, name, status: 'start', label });
    try {
        const result = await body();
        emit({ type: 'tool', id, name, status: 'done', label });
        return result;
    } catch (err) {
        emit({ type: 'tool', id, name, status: 'error', label });
        const reason = err instanceof Error ? err.message : 'error desconocido';
        throw new Error(`La consulta falló (${reason}). Dile al usuario que el servicio no respondió y sugiere una alternativa.`);
    }
}

/** "HH:mm" (+ optional YYYY-MM-DD) → planner date/time params (MM-DD-YYYY, HH:mm). */
function departureParams(hora?: string, fecha?: string): { date?: string; time?: string } {
    if (!hora) return {};
    const m = hora.match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return {};
    const time = `${m[1].padStart(2, '0')}:${m[2]}`;
    let y: number, mo: number, d: number;
    const f = fecha?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (f) {
        y = +f[1]; mo = +f[2]; d = +f[3];
    } else {
        const now = bogotaNow();
        y = now.getFullYear(); mo = now.getMonth() + 1; d = now.getDate();
    }
    return { date: `${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}-${y}`, time };
}

function summarizeItinerary(it: Itinerary, i: number) {
    return {
        opcion: i + 1,
        duracion_min: it.durationMin,
        caminata_m: it.walkMeters,
        transbordos: it.transfers,
        etiquetas: it.tags,
        tramos: it.legs.map((l) =>
            l.mode === 'WALK'
                ? `Caminar ${l.durationMin} min (${l.distanceText}) hasta ${l.to.name}`
                : `${l.line?.code} hacia ${l.line?.longName}: subir en ${l.from.name}, bajar en ${l.to.name} (${(l.stops?.length || 0) + 1} paradas, ${l.durationMin} min)`,
        ),
    };
}

export function createTools(emit: Emit, ctx: AssistantContext): ToolDef[] {
    const buscarLugar = defineTool({
        name: 'buscar_lugar',
        description:
            'Busca un lugar de Bogotá por nombre o dirección (sitios, barrios, direcciones como "Calle 26 # 68-35") y estaciones de TransMilenio. Devuelve candidatos con coordenadas. Úsala antes de planear_viaje cuando el usuario nombra un lugar.',
        inputSchema: z.object({
            consulta: z.string().min(2).max(160).describe('Texto del lugar tal como lo diría el usuario'),
        }),
        run: (input, callId) =>
            track(emit, 'buscar_lugar', `Buscando "${input.consulta}"…`, callId, async () => {
                const near = typeof ctx.lat === 'number' && typeof ctx.lng === 'number' ? { lat: ctx.lat, lng: ctx.lng } : undefined;
                const places = await searchPlaces(input.consulta, near);
                if (!places.length) return 'Sin resultados. Pide al usuario más detalles (barrio, dirección o un sitio cercano).';
                return json(places.slice(0, 6).map((p) => ({ nombre: p.name, detalle: p.detail, tipo: p.kind, lat: +p.lat.toFixed(6), lng: +p.lng.toFixed(6) })));
            }),
    });

    const planearViaje = defineTool({
        name: 'planear_viaje',
        description:
            'Planea un viaje en transporte público entre dos puntos de Bogotá con el planeador oficial (TransMilenio, zonal, alimentadores, caminata). Devuelve hasta 3 opciones resumidas; la app muestra las tarjetas completas.',
        inputSchema: z.object({
            origen: placeSchema.describe('Punto de partida'),
            destino: placeSchema.describe('Punto de llegada'),
            hora_salida: z.string().regex(/^\d{1,2}:\d{2}$/).optional().describe('Hora de salida en formato 24h HH:mm, solo si el usuario quiere salir a otra hora'),
            fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('Fecha YYYY-MM-DD si no es hoy'),
        }),
        run: (input, callId) =>
            track(emit, 'planear_viaje', `Planeando tu viaje a ${input.destino.nombre}…`, callId, async () => {
                const from: PlanPlace = { name: input.origen.nombre, lat: input.origen.lat, lng: input.origen.lng };
                const to: PlanPlace = { name: input.destino.nombre, lat: input.destino.lat, lng: input.destino.lng };
                const itineraries = await planTrip(from, to, departureParams(input.hora_salida, input.fecha));
                if (!itineraries.length) return 'El planeador no encontró opciones para ese trayecto. Sugiere revisar los puntos o intentar otra hora.';
                const top = itineraries.slice(0, 3);
                emit({ type: 'card', card: { kind: 'itineraries', from, to, itineraries: top } });
                return json({ opciones: top.map(summarizeItinerary), nota: 'La app ya muestra estas opciones como tarjetas.' });
            }),
    });

    const buscarRutas = defineTool({
        name: 'buscar_rutas',
        description: 'Busca rutas por código o nombre (p. ej. "K23", "B13", "Portal 80", "Suba"). Devuelve id, código, nombre, tipo y si opera ahora. Usa el id, código y nombre para detalle_ruta o buses_en_vivo.',
        inputSchema: z.object({ texto: z.string().min(1).max(60).describe('Código o nombre de la ruta') }),
        run: (input, callId) =>
            track(emit, 'buscar_rutas', `Buscando la ruta ${input.texto}…`, callId, async () => {
                const routes = await searchRoutes(input.texto);
                if (!routes.length) return 'No se encontraron rutas con ese texto.';
                return json(routes.slice(0, 12).map((r) => ({
                    id: r.id,
                    codigo: r.codigo,
                    nombre: r.nombre,
                    tipo: r.tipoServicio,
                    opera_ahora: isActiveNow(r.horarios?.data),
                })));
            }),
    });

    const detalleRuta = defineTool({
        name: 'detalle_ruta',
        description: 'Recorrido completo (paradas en orden), horarios y si opera ahora de una ruta. Requiere id, código y nombre obtenidos con buscar_rutas.',
        inputSchema: z.object({
            id: z.string().min(1).max(20),
            codigo: z.string().min(1).max(20),
            nombre: z.string().max(120),
        }),
        run: (input, callId) =>
            track(emit, 'detalle_ruta', `Consultando la ruta ${input.codigo}…`, callId, async () => {
                const route = await getRouteDetail(input.id, input.nombre, input.codigo);
                const activeNow = isActiveNow(route.schedules);
                emit({
                    type: 'card',
                    card: {
                        kind: 'route',
                        id: route.id,
                        codigo: route.code,
                        nombre: route.name,
                        color: route.color,
                        schedules: route.schedules,
                        activeNow,
                        stopCount: route.stops.length,
                        firstStop: route.stops[0]?.name,
                        lastStop: route.stops[route.stops.length - 1]?.name,
                    },
                });
                return json({
                    codigo: route.code,
                    nombre: route.name,
                    tipo: route.serviceType,
                    opera_ahora: activeNow,
                    horarios: route.schedules.map((h) => `${h.convencion} ${h.hora_inicio}–${h.hora_fin}`),
                    paradas: route.stops.slice(0, 80).map((s) => s.name),
                });
            }),
    });

    const llegadasEstacion = defineTool({
        name: 'llegadas_estacion',
        description: 'Próximos buses en vivo de una estación de TransMilenio o paradero zonal, por nombre (p. ej. "Calle 72", "Portal Norte"). Si el usuario pregunta por una ruta concreta, pasa su código en `ruta` (la app la resalta en el tablero de llegadas).',
        inputSchema: z.object({
            estacion: z.string().min(2).max(100).describe('Nombre de la estación o paradero'),
            ruta: z.string().max(20).optional().describe('Código de ruta para filtrar, p. ej. "B13"'),
        }),
        run: (input, callId) =>
            track(emit, 'llegadas_estacion', `Leyendo llegadas en ${input.estacion}…`, callId, async () => {
                const matches = await findStations(input.estacion, 3);
                if (!matches.length) return `No encontré una estación llamada "${input.estacion}". Pide el nombre exacto o usa buscar_lugar.`;
                const station = matches[0];
                const arrivals = await getArrivals(station.codigo);
                emit({ type: 'card', card: { kind: 'arrivals', paradero: station.codigo, title: station.nombre, route: input.ruta?.trim().toUpperCase() || undefined } });
                const filter = input.ruta?.trim().toUpperCase();
                const rows = arrivals.filter((a) => !filter || a.code.toUpperCase() === filter).slice(0, 10);
                return json({
                    estacion: station.nombre,
                    codigo: station.codigo,
                    otras_coincidencias: matches.slice(1).map((m) => m.nombre),
                    llegadas: rows.map((a) => ({ ruta: a.code, destino: a.destination, tiempo: a.label, distancia: a.distanceLabel })),
                    ...(filter && !rows.length ? { nota: `No hay ${filter} reportado próximamente en esta estación.` } : {}),
                });
            }),
    });

    const busesEnVivo = defineTool({
        name: 'buses_en_vivo',
        description: 'Cuántos buses de una ruta están circulando ahora y qué tan llenos van. Requiere código y nombre (destino) de la ruta, obtenidos con buscar_rutas.',
        inputSchema: z.object({
            codigo: z.string().min(1).max(20),
            nombre: z.string().max(120).describe('Nombre/destino de la ruta tal como lo devuelve buscar_rutas'),
        }),
        run: (input, callId) =>
            track(emit, 'buses_en_vivo', `Ubicando los buses de la ${input.codigo}…`, callId, async () => {
                const buses = await getLiveBuses(input.codigo, input.nombre);
                const occupancy = { vacio: 0, medio: 0, lleno: 0, sin_dato: 0 };
                for (const b of buses) {
                    if (b.occupancy === 'VACIO') occupancy.vacio++;
                    else if (b.occupancy === 'MEDIO') occupancy.medio++;
                    else if (b.occupancy === 'LLENO') occupancy.lleno++;
                    else occupancy.sin_dato++;
                }
                return json({
                    ruta: input.codigo,
                    buses_circulando: buses.length,
                    ocupacion: occupancy,
                    destinos: [...new Set(buses.map((b) => b.destination).filter(Boolean))],
                    accesibilidad: [...new Set(buses.map((b) => b.accessibility).filter(Boolean))],
                });
            }),
    });

    const estacionesCercanas = defineTool({
        name: 'estaciones_cercanas',
        description: 'Estaciones troncales de TransMilenio y paraderos zonales más cercanos a un punto, con distancia.',
        inputSchema: z.object({ lat, lng }),
        run: (input, callId) =>
            track(emit, 'estaciones_cercanas', 'Buscando estaciones cercanas…', callId, async () => {
                const [troncal, zonal] = await Promise.all([
                    nearestStations(input.lat, input.lng, 4, 'TransMilenio'),
                    nearestStations(input.lat, input.lng, 3, 'TransMiZonal'),
                ]);
                const places: PlanPlace[] = [...troncal, ...zonal].map((s) => ({
                    name: s.nombre,
                    detail: `${s.sistema === 'TransMilenio' ? 'Estación troncal' : 'Paradero zonal'} · ${formatDistance(s.distanceM)}`,
                    lat: s.lat,
                    lng: s.lng,
                    kind: 'station',
                }));
                emit({ type: 'card', card: { kind: 'places', title: 'Estaciones cercanas', places } });
                return json({
                    troncales: troncal.map((s) => ({ nombre: s.nombre, codigo: s.codigo, distancia_m: Math.round(s.distanceM) })),
                    zonales: zonal.map((s) => ({ nombre: s.nombre, codigo: s.codigo, distancia_m: Math.round(s.distanceM) })),
                });
            }),
    });

    const puntosRecarga = defineTool({
        name: 'puntos_recarga_cercanos',
        description: 'Puntos de recarga de la tarjeta TuLlave (tiendas, droguerías) o puntos de personalización de la tarjeta más cercanos a un punto, con horarios.',
        inputSchema: z.object({
            lat,
            lng,
            tipo: z.enum(['recarga', 'personalizacion']).optional().describe('recarga (por defecto) o personalizacion'),
        }),
        run: (input, callId) =>
            track(emit, 'puntos_recarga_cercanos', input.tipo === 'personalizacion' ? 'Buscando puntos de personalización…' : 'Buscando puntos de recarga…', callId, async () => {
                const kind = input.tipo || 'recarga';
                const points = await nearestServicePoints(kind, input.lat, input.lng, 5);
                if (!points.length) return 'No hay puntos registrados cerca.';
                emit({ type: 'card', card: { kind: 'places', title: kind === 'recarga' ? 'Puntos de recarga cercanos' : 'Puntos de personalización', places: points } });
                return json(points.map((p) => ({
                    nombre: p.name,
                    direccion: p.address,
                    distancia_m: Math.round(p.distanceM || 0),
                    horario: { semana: p.hours.wk, sabado: p.hours.sat, domingo_festivo: p.hours.hol },
                })));
            }),
    });

    const clima = defineTool({
        name: 'clima',
        description: 'Clima actual en Bogotá (o en la ubicación del usuario) y si va a llover en las próximas 2 horas.',
        inputSchema: z.object({}),
        run: (_input, callId) =>
            track(emit, 'clima', 'Revisando el clima…', callId, async () => {
                const w = await getWeather(ctx.lat ?? 4.65, ctx.lng ?? -74.1);
                emit({ type: 'card', card: { kind: 'weather', weather: w } });
                return json({
                    temperatura_c: w.temperature,
                    estado: w.summary,
                    lluvia: w.rainInMin === null ? 'no se espera en las próximas 2 horas' : w.rainInMin === 0 ? 'está lloviendo' : `podría llover en ~${w.rainInMin} min`,
                    probabilidad_lluvia_max: w.rainProbability,
                });
            }),
    });

    const tarifa = defineTool({
        name: 'tarifa',
        description: 'Valor actual del pasaje de TransMilenio y TransMiZonal en pesos colombianos.',
        inputSchema: z.object({}),
        run: (_input, callId) =>
            track(emit, 'tarifa', 'Consultando la tarifa…', callId, async () => {
                const fare = await getFare();
                return json({ tarifa_cop: fare, nota: 'Mismo valor para TransMilenio y TransMiZonal según la información oficial de la app.' });
            }),
    });

    // Order is part of the cached prefix: keep it fixed.
    return <ToolDef[]>[buscarLugar, planearViaje, buscarRutas, detalleRuta, llegadasEstacion, busesEnVivo, estacionesCercanas, puntosRecarga, clima, tarifa];
}
