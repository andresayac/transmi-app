import 'server-only';

import { z } from 'zod/v4';
import {
    findStations,
    findTroncal,
    findZone,
    getArrivals,
    getCardBalance,
    getFare,
    getLiveBuses,
    getRouteDetail,
    getTroncales,
    getTroncalStations,
    getWeather,
    getZones,
    nearestServicePoints,
    nearestStations,
    planTrip,
    routesAtStation,
    routesInZone,
    searchPlaces,
    searchRoutes,
} from '@/lib/server/transit';
import { getSharedTrip, SHARE_ID } from '@/lib/server/sharedTrips';
import { formatDistance } from '@/lib/geo';
import { tripsLeft } from '@/lib/balance';
import { bogotaNow, formatTime, isActiveNow, openingState } from '@/lib/schedule';
import { unpackTrip, type ShareState, type SharedTrip } from '@/lib/tripShare';
import { plannerUrl, stopLabel, ymd } from '@/components/plan/utils';
import type { AssistantContext, AssistantEvent } from '@/components/assistant/types';
import type { Itinerary, PlanPlace } from '@/types/transit';
import type { RouteSearchResult } from '@/types/route';

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

/** A route as the tools list it: enough for detalle_ruta and buses_en_vivo. */
const routeRow = (r: RouteSearchResult) => ({
    id: r.id,
    codigo: r.codigo,
    nombre: r.nombre,
    tipo: r.tipoServicio,
    opera_ahora: isActiveNow(r.horarios?.data),
});

/** Bogotá clock time for an instant: "6:40 pm". */
const bogotaClock = (ms: number) => formatTime(bogotaNow(new Date(ms)));

/** Minutes after midnight (may pass 24 h) → "9:00 pm". */
const clockText = (min: number) => formatTime(new Date(2000, 0, 1, Math.floor(min / 60) % 24, min % 60));

/** "2026-11-05 18:20:00 UTC" → "5/11/2026 1:20 pm" in Bogotá; anything else as it came. */
function bogotaDateTime(raw: string): string {
    const d = new Date(raw.replace(' UTC', 'Z'));
    if (Number.isNaN(d.getTime())) return raw;
    const b = bogotaNow(d);
    return `${b.getDate()}/${b.getMonth() + 1}/${b.getFullYear()} ${formatTime(b)}`;
}

/** The id in ".../sigue/Xk3a9Qz2Lp", or the id alone. */
function shareIdFrom(link: string): string | null {
    const text = link.trim();
    if (SHARE_ID.test(text)) return text;
    return text.match(/\/sigue\/([A-Za-z0-9_-]{10})(?:[/?#]|$)/)?.[1] ?? null;
}

/** Where a shared trip is, in words. `state` is null for #links, which carry only the plan. */
function describeSharedTrip(trip: SharedTrip, state: ShareState | null) {
    const at = (p: [string, number, number]) => stopLabel(p[0]).station;
    const legIndex = Math.min(state?.leg ?? trip.cur, trip.legs.length - 1);
    const leg = trip.legs[legIndex];
    const next = trip.legs.slice(legIndex + 1).find((l) => l.m === 'T');
    const quietMin = state ? Math.round((Date.now() - state.at) / 60000) : null;
    return {
        ...(trip.by ? { quien: trip.by } : {}),
        destino: at(trip.to),
        llego: state?.ended ?? false,
        ...(state?.ended ? {} : {
            tramo_actual: leg.m === 'T' ? `En el ${leg.c} hacia ${leg.n}, de ${at(leg.f)} a ${at(leg.t)}` : `Caminando hacia ${at(leg.t)}`,
            ...((state?.bus ?? trip.bus) ? { bus: state?.bus ?? trip.bus } : {}),
            ...(next ? { despues: `Toma el ${next.c} en ${at(next.f)}` } : {}),
            llegada_estimada: bogotaClock(state?.eta ?? trip.eta * 1000),
        }),
        ...(quietMin === null
            ? { nota: 'Este enlace trae solo el plan del viaje, sin avances en vivo.' }
            : quietMin >= 10 && !state?.ended
                ? { nota: `El teléfono no reporta hace ${quietMin} min: la hora de llegada es la del plan.` }
                : {}),
    };
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

export interface ToolOptions {
    /**
     * Set when the tools run outside the app (MCP clients such as Claude, ChatGPT or Gemini): nobody renders the
     * cards, so results link to the app at this origin instead.
     */
    appOrigin?: string;
}

export function createTools(emit: Emit, ctx: AssistantContext, { appOrigin }: ToolOptions = {}): ToolDef[] {
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
            'Planea un viaje en transporte público entre dos puntos de Bogotá con el planeador oficial (TransMilenio, zonal, alimentadores, caminata). Devuelve hasta 3 opciones resumidas' +
            (appOrigin ? ' y un enlace para verlas completas en la app TransMi: compártelo con el usuario.' : '; la app muestra las tarjetas completas.'),
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
                if (!appOrigin) return json({ opciones: top.map(summarizeItinerary), nota: 'La app ya muestra estas opciones como tarjetas.' });
                // The planner wants both date and time to leave later; a time alone means today
                const when: Record<string, string> = input.hora_salida ? { date: input.fecha || ymd(bogotaNow()), time: input.hora_salida.padStart(5, '0') } : {};
                return json({ opciones: top.map(summarizeItinerary), abrir_en_transmi: appOrigin + plannerUrl(from, to, when) });
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
                return json(routes.slice(0, 12).map(routeRow));
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
        description:
            'Próximos buses en vivo de una estación de TransMilenio o paradero zonal, por nombre (p. ej. "Calle 72", "Portal Norte"). Si el usuario pregunta por una ruta concreta, pasa su código en `ruta`' +
            (appOrigin ? '.' : ' (la app la resalta en el tablero de llegadas).'),
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
        description:
            'Puntos de recarga de la tarjeta TuLlave (tiendas, droguerías) o puntos de personalización de la tarjeta más cercanos a un punto, con horarios y si están abiertos ahora (festivos incluidos).',
        inputSchema: z.object({
            lat,
            lng,
            tipo: z.enum(['recarga', 'personalizacion']).optional().describe('recarga (por defecto) o personalizacion'),
            solo_abiertos: z.boolean().optional().describe('true para traer solo los que están abiertos ahora'),
        }),
        run: (input, callId) =>
            track(emit, 'puntos_recarga_cercanos', input.tipo === 'personalizacion' ? 'Buscando puntos de personalización…' : 'Buscando puntos de recarga…', callId, async () => {
                const kind = input.tipo || 'recarga';
                const now = bogotaNow();
                // Open ones can be a few blocks further than the nearest: look wider before filtering
                const nearest = await nearestServicePoints(kind, input.lat, input.lng, input.solo_abiertos ? 25 : 5);
                const rows = nearest
                    .map((p) => ({ p, state: openingState(p.hours, now) }))
                    .filter((r) => !input.solo_abiertos || r.state.open)
                    .slice(0, 5);
                if (!rows.length) return input.solo_abiertos ? 'No hay puntos abiertos ahora cerca. Ofrece los más cercanos con su horario.' : 'No hay puntos registrados cerca.';
                const points = rows.map((r) => r.p);
                emit({ type: 'card', card: { kind: 'places', title: kind === 'recarga' ? 'Puntos de recarga cercanos' : 'Puntos de personalización', places: points } });
                return json(rows.map(({ p, state }) => ({
                    nombre: p.name,
                    direccion: p.address,
                    distancia_m: Math.round(p.distanceM || 0),
                    abierto_ahora: state.open,
                    ...(state.closesAt !== null ? { cierra: clockText(state.closesAt) } : {}),
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

    const consultarSaldo = defineTool({
        name: 'consultar_saldo',
        description:
            'Saldo de una tarjeta TuLlave y para cuántos viajes alcanza con la tarifa actual. Necesita el número impreso al respaldo de la tarjeta: si el usuario no lo ha dado, pídeselo. No repitas el número completo en tu respuesta.',
        inputSchema: z.object({
            numero_tarjeta: z.string().regex(/^\d{10,20}$/).describe('Número de la tarjeta: solo dígitos, sin espacios'),
        }),
        run: (input, callId) =>
            track(emit, 'consultar_saldo', 'Consultando el saldo…', callId, async () => {
                // An unknown card and a service hiccup look the same upstream (an empty answer), as in the app
                const [balance, fare] = await Promise.all([getCardBalance(input.numero_tarjeta).catch(() => null), getFare()]);
                if (!balance) {
                    return 'No se pudo leer esa tarjeta. Pide al usuario revisar el número impreso al respaldo; si está bien, el servicio de TransMilenio puede no estar respondiendo y conviene intentar en un momento.';
                }
                const trips = tripsLeft(balance.value, fare);
                return json({
                    saldo_cop: balance.value,
                    alcanza_para_viajes: trips,
                    tarifa_cop: fare,
                    ...(balance.kind ? { tipo_tarjeta: balance.kind } : {}),
                    ...(balance.lastTransaction ? { ultima_transaccion: bogotaDateTime(balance.lastTransaction) } : {}),
                    ...(trips < 2 ? { nota: 'Saldo bajo: ofrece buscar un punto de recarga abierto ahora con puntos_recarga_cercanos.' } : {}),
                });
            }),
    });

    const rutasEstacion = defineTool({
        name: 'rutas_estacion',
        description:
            'Rutas que paran en una estación de TransMilenio o paradero zonal, por nombre (p. ej. "Calle 72", "Portal Norte"), y si operan ahora. Devuelve id, código y nombre para detalle_ruta o buses_en_vivo.',
        inputSchema: z.object({ estacion: z.string().min(2).max(100).describe('Nombre de la estación o paradero') }),
        run: (input, callId) =>
            track(emit, 'rutas_estacion', `Buscando las rutas de ${input.estacion}…`, callId, async () => {
                const matches = await findStations(input.estacion, 3);
                if (!matches.length) return `No encontré una estación llamada "${input.estacion}". Pide el nombre exacto o usa buscar_lugar.`;
                const station = matches[0];
                const routes = await routesAtStation(station.id);
                return json({
                    estacion: station.nombre,
                    otras_coincidencias: matches.slice(1).map((m) => m.nombre),
                    rutas: routes.slice(0, 50).map(routeRow),
                    ...(routes.length ? {} : { nota: 'TransMilenio no reporta rutas para esta parada. Prueba llegadas_estacion para ver qué buses vienen.' }),
                });
            }),
    });

    const troncales = defineTool({
        name: 'troncales',
        description:
            'Troncales de TransMilenio (p. ej. A Caracas, B Autonorte, T TransMiCable). Con `troncal`, sus estaciones en orden a lo largo de la línea; sin ella, la lista de troncales.',
        inputSchema: z.object({
            troncal: z.string().max(60).optional().describe('Letra o nombre de la troncal, p. ej. "B" o "Autonorte"'),
        }),
        run: (input, callId) =>
            track(emit, 'troncales', input.troncal ? `Consultando la troncal ${input.troncal}…` : 'Consultando las troncales…', callId, async () => {
                const troncal = input.troncal?.trim() ? await findTroncal(input.troncal) : null;
                if (!troncal) {
                    const list = (await getTroncales()).map((t) => `${t.letra} ${t.nombre}`);
                    return json(input.troncal?.trim() ? { nota: `No hay una troncal "${input.troncal}".`, troncales: list } : { troncales: list });
                }
                const stations = await getTroncalStations(troncal.id);
                return json({ troncal: `${troncal.letra} ${troncal.nombre}`, estaciones: stations.map((e) => e.nombre) });
            }),
    });

    const zonasSitp = defineTool({
        name: 'zonas_sitp',
        description:
            'Zonas del SITP (TransMiZonal), como "Suba" o "Kennedy / Las Américas". Con `zona`, las rutas zonales de esa zona y si operan ahora; sin ella, la lista de zonas.',
        inputSchema: z.object({
            zona: z.string().max(60).optional().describe('Nombre de la zona o localidad, p. ej. "Suba" o "Usme"'),
        }),
        run: (input, callId) =>
            track(emit, 'zonas_sitp', input.zona ? `Consultando la zona ${input.zona}…` : 'Consultando las zonas del SITP…', callId, async () => {
                const zone = input.zona?.trim() ? await findZone(input.zona) : null;
                if (!zone) {
                    const list = (await getZones()).map((z) => z.nombre);
                    return json(input.zona?.trim() ? { nota: `No hay una zona "${input.zona}".`, zonas: list } : { zonas: list });
                }
                const routes = await routesInZone(zone.id);
                return json({ zona: zone.nombre, total_rutas: routes.length, rutas: routes.slice(0, 60).map(routeRow) });
            }),
    });

    const seguirViaje = defineTool({
        name: 'seguir_viaje',
        description:
            'Cómo va un viaje compartido con "Sigue mi viaje" de TransMi, con el enlace que le enviaron al usuario (…/sigue/Xk3a9Qz2Lp): hacia dónde va, en qué tramo y bus va, a qué hora llega y si ya llegó.',
        inputSchema: z.object({
            enlace: z.string().min(10).max(4000).describe('El enlace completo de "Sigue mi viaje", o su código de 10 caracteres'),
        }),
        run: (input, callId) =>
            track(emit, 'seguir_viaje', 'Consultando el viaje compartido…', callId, async () => {
                const id = shareIdFrom(input.enlace);
                if (id) {
                    const shared = await getSharedTrip(id);
                    if (!shared) return 'Ese enlace no existe o ya expiró (duran 3 días).';
                    return json({
                        ...describeSharedTrip(shared.trip, shared.state),
                        ...(appOrigin ? { ver_en_vivo: `${appOrigin}/sigue/${id}` } : {}),
                    });
                }
                // Links made when a short one couldn't be: the whole trip after the #
                const trip = unpackTrip(input.enlace.split('#')[1] ?? '');
                if (!trip) return 'Ese enlace no es de "Sigue mi viaje" o se cortó al copiarlo. Pide el enlace completo.';
                return json(describeSharedTrip(trip, null));
            }),
    });

    // Order is part of the cached prefix: keep it fixed, and add new tools at the end.
    return <ToolDef[]>[
        buscarLugar, planearViaje, buscarRutas, detalleRuta, llegadasEstacion, busesEnVivo, estacionesCercanas, puntosRecarga, clima, tarifa,
        consultarSaldo, rutasEstacion, troncales, zonasSitp, seguirViaje,
    ];
}
