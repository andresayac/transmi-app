# 🚍 TransMi — Alternativa Educativa de TransMilenio

<p align="center">
  <strong>Una aplicación web progresiva que reimagina cómo moverse por Bogotá en TransMilenio y el SITP: planeador de viajes, buses en vivo, modo viaje con alarma y un asistente con IA.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-black?logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react" alt="React" />
  <img src="https://img.shields.io/badge/Mapbox-GL_3-4264FB?logo=mapbox" alt="Mapbox" />
  <img src="https://img.shields.io/badge/IA-API_compatible_con_OpenAI-555555" alt="IA" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Tailwind-4-06B6D4?logo=tailwindcss" alt="Tailwind" />
</p>

---

## ⚠️ Aviso Legal

> **Este proyecto es estrictamente educativo y no tiene fines comerciales.** Fue creado como un ejercicio de aprendizaje para explorar el uso de APIs de mapas, diseño de interfaces móviles y desarrollo web moderno. No busca reemplazar ni competir con la [app oficial de TransMilenio](https://play.google.com/store/apps/details?id=com.nexura.transmilenio&hl=es_CO). Todos los datos de rutas y estaciones pertenecen a TransMilenio S.A.

---

## 💡 Origen del Proyecto

La idea surgió como un **proyecto educativo** para aprender a integrar APIs de mapas, diseñar interfaces mobile-first y consumir datos de transporte público. Al explorar la app oficial surgió la pregunta: *¿qué tendría una app de transporte si se diseñara hoy, desde cero?* La versión 3 es la respuesta.

---

## ✨ Funcionalidades

### 🏠 Inicio
- **Tu rutina**: aprende tus viajes frecuentes (y usa Casa/Trabajo) para decirte **"Sal en 6 min"**, sumando la caminata y el próximo bus en la dirección correcta
- **Mis paradas**: fija las estaciones que usas a diario y mira sus llegadas en vivo apenas abres la app
- **Instalar TransMi**: aviso para agregarla a la pantalla de inicio (Android e iPhone)
- **¿A dónde vas?**: un toque para planear, con accesos a Casa, Trabajo, lugares guardados y recientes
- **Cerca de ti**: la estación de **TransMilenio** o el paradero del **SITP** más cercano (eliges cuál; recuerda tu elección) con un **tablero de llegadas en vivo** (animación tipo split-flap), y los otros paraderos a pocos pasos, como el del otro lado de la calle
- **Clima** de Bogotá con aviso de **"lluvia en ~N min"**
- **Saldo TuLlave** con cuántos viajes alcanzan según la tarifa vigente; descuenta los viajes hechos desde la última consulta y, cuando el saldo es bajo, muestra el **punto de recarga más cercano abierto ahora** (con su horario, festivos incluidos). Tu rutina también avisa si no alcanza para el pasaje

### 🧭 Planeador de viajes (`/planear`)
- Origen y destino con búsqueda de lugares (OpenStreetMap), estaciones, tu ubicación y lugares guardados
- Itinerarios del planeador oficial (OpenTripPlanner) con barra de tramos proporcional al tiempo, transbordos y caminata
- Etiquetas **Más rápida / Menos transbordos / Menos caminata** y aviso del **próximo bus** en la estación de abordaje
- Detalle con mapa, paso a paso y paradas intermedias

### 🛰️ Modo viaje (`/viaje`)
- Progreso en vivo sobre el **diagrama de la línea**, próxima parada y hora estimada de llegada
- **Despiértame**: vibración, sonido, voz y notificación N paradas antes de bajarte (las frases se sintetizan por adelantado para sonar al instante)
- **Avisos con la app cerrada**: el teléfono congela las apps web en segundo plano, así que el servidor sigue **el bus en que vas** (datos en vivo de TransMilenio, nunca tu ubicación) y te envía una **notificación push** antes de tu parada y al llegar, con el siguiente paso si haces transbordo. Basta con tener TransMi abierta hasta que reconozca tu bus; si no lo reconoce, avisa una vez según el tiempo estimado. En iPhone requiere TransMi instalada en la pantalla de inicio (iOS 16.4+)
- **Sigue mi viaje**: comparte un **enlace corto** (`/sigue/Xk3a9Qz2Lp`) por la app que quieras; quien lo abre ve **tu bus moviéndose en vivo**, tu hora de llegada y **el siguiente bus si haces transbordo**. Se sigue al bus (datos en vivo de TransMilenio), nunca la ubicación de tu celular: el teléfono solo informa en qué tramo y en qué bus vas. Los viajes se guardan como archivos en `.data/` (configurable con `DATA_DIR`) y se borran a los 3 días
- Pantalla siempre encendida (Wake Lock) y modo simulación (`/viaje?demo=1`) para probar sin moverse

### 🗺️ Mapa en vivo (`/mapa`)
- Mapbox **Standard monocromo en 3D**, con luz real del cielo de Bogotá (amanecer, día, atardecer, noche)
- **Trazado real** de cada ruta y **buses que se desplazan suavemente**, con **ocupación** (vacío / medio / lleno) y accesibilidad
- **Diagrama de línea** estilo metro con los buses moviéndose entre estaciones y tiempos de llegada por parada
- Comparación de varias rutas (multi-ruta), estaciones con llegadas en vivo y capas de **puntos de recarga** y **personalización** TuLlave

### ✨ Asistente con IA (`/asistente`)
- Conversación en español con **cualquier proveedor compatible con el estándar de chat completions** (Groq, Xiaomi MiMo, OpenRouter, DeepSeek, Ollama…) y herramientas sobre los datos reales: buscar lugares, planear viajes, rutas, llegadas, buses en vivo, recargas, clima y tarifa
- Respuestas con **tarjetas interactivas** (itinerarios que se inician con un toque, tableros de llegadas, rutas)
- **Dictado por voz** (es-CO) y lectura en voz alta con voces neuronales

### 🔌 Conéctala a Claude (MCP, `/api/mcp`)
- Servidor **MCP** (Streamable HTTP) con las mismas herramientas del asistente, de solo lectura: buscar lugares, planear viajes, rutas, llegadas, buses en vivo, estaciones cercanas, recargas, clima y tarifa
- Cada viaje planeado trae un enlace que lo abre en el planeador de TransMi
- No necesita cuenta ni clave: los datos son públicos
- La pantalla **`/conectar`** (enlazada desde Guardados y el asistente) explica los pasos con la dirección del sitio lista para copiar
- **Claude (web o escritorio)**: *Configuración → Conectores → Agregar conector personalizado* y pega `https://tu-dominio/api/mcp`. Después también funciona en la app del celular
- **Claude Code**: `claude mcp add --transport http transmi https://tu-dominio/api/mcp`
- Claude se conecta desde sus servidores, así que la URL debe ser pública y con https. Para probar en local usa Claude Code con `http://localhost:3000/api/mcp`

### 🔍 Explorar y ⭐ Guardados
- Búsqueda de rutas con comparación en el mapa, troncales como diagrama de línea, zonas y paradas con llegadas en vivo
- Casa, Trabajo y lugares propios; rutas guardadas; estadísticas de **tu movilidad** (viajes, horas, km, CO₂ evitado estimado); ajustes de tema, luz del mapa, alarma y **voz** (Ava, Emma, Andrew o Brian, con muestra)

### 🎨 Diseño
- **Monocromo + color con significado**: la interfaz es negra y blanca; el único color viene de los datos (colores de troncales y rutas, ocupación)
- Tipografía de señalética: **Barlow** y **Barlow Condensed**
- **Franja del sistema**: firma visual con los 15 colores oficiales de las troncales
- Modo claro, oscuro o del sistema, sin parpadeo al cargar
- **Versión para computadora** (desde 1024 px): barra de navegación vertical con la franja del sistema como eje; mapa con panel lateral; planeador con las opciones a la izquierda y la ruta en el mapa a la derecha (al pasar el cursor por una opción se dibuja); copiloto e inicio en dos columnas. En el celular nada cambia

### 📶 Para todos los días
- **Ahorro de datos** (se activa solo si el teléfono lo pide): mapas planos y bajo pedido (mientras tanto, un **esquema del recorrido dibujado sin descargar nada**), datos en vivo con la mitad de consultas y avisos con la voz del teléfono. El catálogo de 7.400 paradas se guarda un mes en el teléfono
- **Tamaño de letra** (Normal, Grande, Muy grande) y **Más contraste**; la app sigue además el tamaño de letra y el contraste del teléfono
- **Festivos de Colombia** calculados en el teléfono (Ley Emiliani y Semana Santa): horarios de rutas, rutina y puntos de recarga usan el horario de domingos y festivos

---

## 🛠️ Stack Tecnológico

| Tecnología | Uso |
|---|---|
| **Next.js 16** | App Router, rutas API como capa de datos y proxy |
| **React 19** | UI con hooks |
| **TypeScript 5** | Tipado estático |
| **Tailwind CSS 4** | Sistema de diseño con tokens |
| **Mapbox GL JS 3** | Estilo Standard monocromo, 3D, capas GeoJSON |
| **Cliente `openai` + Zod** | Asistente con herramientas en streaming sobre cualquier API compatible (host + clave + modelo) |
| **Zustand** | Estado persistente (favoritos, lugares, viajes, ajustes) con migración desde v2 |
| **Motion** | Paneles inferiores arrastrables |
| **Open-Meteo / Photon** | Clima y búsqueda de lugares sin clave |
| **@andresaya/edge-tts** | Voces neuronales de Microsoft Edge (multilingües, en español de Colombia) servidas por `/api/voz` con caché |

---

## 📁 Estructura del Proyecto

```
src/
├── app/
│   ├── page.tsx              # Inicio
│   ├── planear/              # Planeador A→B
│   ├── viaje/                # Modo viaje (copiloto)
│   ├── mapa/                 # Mapa en vivo
│   ├── asistente/            # Chat con IA
│   ├── explorar/             # Rutas, troncales, zonas, paradas
│   ├── favoritos/            # Guardados, movilidad y ajustes
│   ├── conectar/             # Cómo usar TransMi desde Claude (MCP)
│   └── api/
│       ├── plan/             # Planeador (OpenTripPlanner oficial)
│       ├── geocode/          # Lugares y dirección inversa
│       ├── llegadas/         # Llegadas en vivo por estación/paradero
│       ├── live/             # Buses en vivo normalizados (ocupación, rumbo)
│       ├── eta/              # Próximos buses de una ruta en una parada
│       ├── routes/detail/    # Ruta con trazado real y paradas
│       ├── stations/         # Estaciones (+ /nearby)
│       ├── puntos/           # Puntos de recarga y personalización
│       ├── clima/  info/     # Clima y tarifa
│       ├── sigue/            # Enlaces cortos de "Sigue mi viaje"
│       ├── avisos/           # Avisos push con la app cerrada
│       ├── asistente/        # Asistente (streaming NDJSON)
│       └── mcp/              # Servidor MCP para Claude y otros clientes
├── components/
│   ├── transit/              # RouteBadge, LineDiagram, ArrivalBoard, SegmentBar…
│   ├── mapa/  plan/  trip/   # Piezas de cada experiencia
│   ├── assistant/            # Chat, tarjetas, voz
│   └── home/  places/  brand/  layout/  ui/
├── lib/
│   ├── server/               # Clientes upstream, normalizadores, asistente, avisos (tripAlerts/)
│   ├── geo.ts  schedule.ts  color.ts  mapbox.ts
├── stores/app.ts             # Estado persistente
└── hooks/                    # useLiveData, useGeolocation…
```

---

## 🚀 Instalación y Uso

```bash
pnpm install
cp .env.example .env.local   # completa las variables
pnpm dev                     # http://localhost:3000
pnpm test                    # pruebas de la lógica (Vitest)
```

### Variables de entorno

| Variable | Requerida | Descripción |
|---|---|---|
| `NEXT_PUBLIC_MAPBOX_TOKEN` | ✅ Sí | Token de [Mapbox](https://account.mapbox.com/access-tokens/) para el mapa |
| `BUS_API_TOKEN` | ❌ Opcional | Token del proxy (`x-auth-token`) para los datos en vivo |
| `PROXY_BASE` | ❌ Opcional | Proxy para la API en vivo cuando se despliega fuera de Colombia |
| `AI_BASE_URL` | ❌ Opcional | Host de una API compatible (p. ej. `https://api.groq.com/openai/v1`, `https://api.xiaomimimo.com/v1`) |
| `AI_API_KEY` | ❌ Opcional | Clave de ese proveedor (vacía para servidores locales como Ollama) |
| `AI_MODEL` | ❌ Opcional | Modelo con soporte de *tools* (p. ej. `openai/gpt-oss-120b` en Groq, `mimo-v2.6-flash` en MiMo) |
| `AI_FALLBACK_BASE_URL` · `_API_KEY` · `_MODEL` | ❌ Opcional | Segundo proveedor que responde si el principal falla |
| `AI_REASONING_EFFORT` · `AI_MAX_TOKENS` | ❌ Opcional | Parámetros estándar, solo se envían si los defines |
| `NEXT_PUBLIC_MAP_PROVIDER` | ❌ Opcional | `mapbox` o `openfreemap`. Sin definir: Mapbox, con cambio automático a OpenFreeMap si Mapbox rechaza las teselas |
| `DATA_DIR` | ❌ Opcional | Carpeta de los viajes compartidos y de los avisos (por defecto `./.data`) |
| `VAPID_PUBLIC_KEY` · `VAPID_PRIVATE_KEY` | ❌ Opcional | Llaves de las notificaciones push. Sin definir, se generan solas la primera vez y se guardan en `DATA_DIR/vapid.json` |
| `VAPID_SUBJECT` | ❌ Opcional | Contacto para los servicios push (`mailto:…` o `https://…`). Por defecto, la dirección https del sitio |

Para verificar la conexión y que el modelo llame herramientas: `GET /api/asistente?probar=1`.

#### Sobre `PROXY_BASE`

Las rutas que consultan datos en vivo (`/api/live`, `/api/llegadas`, `/api/eta`, `/api/puntos`, `/api/saldo`…) usan `PROXY_BASE` si está definido:

```
PROXY_BASE?url=https://tmsa-transmiapp-shvpc.uc.r.appspot.com/endpoint
```

El planeador (`/api/plan`) siempre llama directo: el servicio de planeación rechaza las solicitudes que llegan por el proxy.

---

## 🎓 Aprendizajes Clave

1. **Mapbox GL 3**: estilo Standard configurable, capas por *slot*, interpolación de marcadores
2. **Next.js App Router**: rutas API como capa de normalización con caché por TTL
3. **IA aplicada**: un agente con herramientas sobre datos reales, en streaming, con tarjetas de UI
4. **APIs del navegador**: geolocalización continua, Wake Lock, vibración, voz (Speech Synthesis / Recognition), notificaciones
5. **Diseño de sistemas**: señalética, color con significado y un diagrama de línea como pieza central

---

## 📄 Licencia

Este proyecto es de uso **exclusivamente educativo**. No cuenta con licencia comercial. Los datos y la marca TransMilenio pertenecen a **TransMilenio S.A.**

---

<p align="center">
  <em>Hecho con ❤️ como proyecto de aprendizaje — Bogotá, Colombia 🇨🇴</em>
</p>
