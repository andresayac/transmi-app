# 🚍 TransMi — Alternativa Educativa de TransMilenio

<p align="center">
  <strong>Una aplicación web progresiva que reimagina cómo moverse por Bogotá en TransMilenio y el SITP: planeador de viajes, buses en vivo, modo viaje con alarma y un asistente con IA.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-black?logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react" alt="React" />
  <img src="https://img.shields.io/badge/Mapbox-GL_3-4264FB?logo=mapbox" alt="Mapbox" />
  <img src="https://img.shields.io/badge/Claude-Opus_5.5-D97757" alt="Claude" />
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
- **¿A dónde vas?**: un toque para planear, con accesos a Casa, Trabajo, lugares guardados y recientes
- **Estación más cercana** con un **tablero de llegadas en vivo** (animación tipo split-flap) para todas las rutas que paran ahí
- **Clima** de Bogotá con aviso de **"lluvia en ~N min"**
- **Saldo TuLlave** con cuántos viajes alcanzan según la tarifa vigente, y enlace a puntos de recarga cuando el saldo es bajo

### 🧭 Planeador de viajes (`/planear`)
- Origen y destino con búsqueda de lugares (OpenStreetMap), estaciones, tu ubicación y lugares guardados
- Itinerarios del planeador oficial (OpenTripPlanner) con barra de tramos proporcional al tiempo, transbordos y caminata
- Etiquetas **Más rápida / Menos transbordos / Menos caminata** y aviso del **próximo bus** en la estación de abordaje
- Detalle con mapa, paso a paso y paradas intermedias

### 🛰️ Modo viaje (`/viaje`)
- Progreso en vivo sobre el **diagrama de la línea**, próxima parada y hora estimada de llegada
- **Despiértame**: vibración, sonido, voz y notificación N paradas antes de bajarte
- Pantalla siempre encendida (Wake Lock) y modo simulación (`/viaje?demo=1`) para probar sin moverse

### 🗺️ Mapa en vivo (`/mapa`)
- Mapbox **Standard monocromo en 3D**, con luz real del cielo de Bogotá (amanecer, día, atardecer, noche)
- **Trazado real** de cada ruta y **buses que se desplazan suavemente**, con **ocupación** (vacío / medio / lleno) y accesibilidad
- **Diagrama de línea** estilo metro con los buses moviéndose entre estaciones y tiempos de llegada por parada
- Comparación de varias rutas (multi-ruta), estaciones con llegadas en vivo y capas de **puntos de recarga** y **personalización** TuLlave

### ✨ Asistente con IA (`/asistente`)
- Conversación en español con **Claude Opus 5.5** y herramientas sobre los datos reales: buscar lugares, planear viajes, rutas, llegadas, buses en vivo, recargas, clima y tarifa
- Respuestas con **tarjetas interactivas** (itinerarios que se inician con un toque, tableros de llegadas, rutas)
- **Dictado por voz** (es-CO) y lectura en voz alta

### 🔍 Explorar y ⭐ Guardados
- Búsqueda de rutas con comparación en el mapa, troncales como diagrama de línea, zonas y paradas con llegadas en vivo
- Casa, Trabajo y lugares propios; rutas guardadas; estadísticas de **tu movilidad** (viajes, horas, km, CO₂ evitado estimado); ajustes de tema, luz del mapa, voz y alarma

### 🎨 Diseño
- **Monocromo + color con significado**: la interfaz es negra y blanca; el único color viene de los datos (colores de troncales y rutas, ocupación)
- Tipografía de señalética: **Barlow** y **Barlow Condensed**
- **Franja del sistema**: firma visual con los 15 colores oficiales de las troncales
- Modo claro, oscuro o del sistema, sin parpadeo al cargar

---

## 🛠️ Stack Tecnológico

| Tecnología | Uso |
|---|---|
| **Next.js 16** | App Router, rutas API como capa de datos y proxy |
| **React 19** | UI con hooks |
| **TypeScript 5** | Tipado estático |
| **Tailwind CSS 4** | Sistema de diseño con tokens |
| **Mapbox GL JS 3** | Estilo Standard monocromo, 3D, capas GeoJSON |
| **Anthropic SDK** | Asistente con tool runner en streaming, fallbacks y prompt caching |
| **Zustand** | Estado persistente (favoritos, lugares, viajes, ajustes) con migración desde v2 |
| **Motion** | Paneles inferiores arrastrables |
| **Open-Meteo / Photon** | Clima y búsqueda de lugares sin clave |

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
│       └── asistente/        # Asistente (streaming NDJSON)
├── components/
│   ├── transit/              # RouteBadge, LineDiagram, ArrivalBoard, SegmentBar…
│   ├── mapa/  plan/  trip/   # Piezas de cada experiencia
│   ├── assistant/            # Chat, tarjetas, voz
│   └── home/  places/  brand/  layout/  ui/
├── lib/
│   ├── server/               # Clientes upstream, normalizadores, asistente
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
```

### Variables de entorno

| Variable | Requerida | Descripción |
|---|---|---|
| `NEXT_PUBLIC_MAPBOX_TOKEN` | ✅ Sí | Token de [Mapbox](https://account.mapbox.com/access-tokens/) para el mapa |
| `BUS_API_TOKEN` | ❌ Opcional | Token del proxy (`x-auth-token`) para los datos en vivo |
| `PROXY_BASE` | ❌ Opcional | Proxy para la API en vivo cuando se despliega fuera de Colombia |
| `ANTHROPIC_API_KEY` | ❌ Opcional | Activa el asistente con IA. Sin ella el resto de la app funciona |
| `ASSISTANT_MODEL` | ❌ Opcional | Modelo del asistente (por defecto `claude-opus-5-5`) |
| `ASSISTANT_EFFORT` | ❌ Opcional | `low` (por defecto) · `medium` · `high` · `xhigh` · `max` |

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
