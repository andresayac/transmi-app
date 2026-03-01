# 🚍 TransMi — Alternativa Educativa de TransMilenio

<p align="center">
  <strong>Una aplicación web progresiva que reimagina la experiencia de consulta del sistema TransMilenio de Bogotá.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-black?logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react" alt="React" />
  <img src="https://img.shields.io/badge/Mapbox-GL-4264FB?logo=mapbox" alt="Mapbox" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Tailwind-4-06B6D4?logo=tailwindcss" alt="Tailwind" />
</p>

---

## ⚠️ Aviso Legal

> **Este proyecto es estrictamente educativo y no tiene fines comerciales.** Fue creado como un ejercicio de aprendizaje para explorar el uso de APIs de mapas, diseño de interfaces móviles y desarrollo web moderno. No busca reemplazar ni competir con la [app oficial de TransMilenio](https://play.google.com/store/apps/details?id=com.nexura.transmilenio&hl=es_CO). Todos los datos de rutas y estaciones pertenecen a TransMilenio S.A.

---

## 💡 Origen del Proyecto

La idea surgió como un **proyecto educativo** para aprender a:

- Integrar **APIs de mapas** (Mapbox GL JS) en aplicaciones web modernas
- Diseñar **interfaces mobile-first** con estándares de UI/UX actuales
- Consumir y transformar **APIs REST** de datos de transporte público
- Implementar patrones de desarrollo como **búsqueda en tiempo real**, **geolocalización**, y **visualización de datos geoespaciales**

Al explorar la app oficial de TransMilenio, surgió la pregunta: *¿cómo se podría construir una alternativa que añada funcionalidades útiles como la comparación de múltiples rutas en el mapa?* Así nació **TransMi**.

---

## ✨ Funcionalidades

### 🏠 Inicio
- **Búsqueda inteligente** de rutas y estaciones con historial de búsquedas recientes
- **Consulta de saldo TuLlave** ingresando el número de tarjeta
- **Accesos rápidos** a rutas favoritas y populares
- Saludo dinámico según la hora del día

### 🗺️ Mapa Interactivo
- **Mapa en tiempo real** con Mapbox GL JS y estilo oscuro profesional
- **Clusters de estaciones** con colores adaptativos para fácil visualización
- **Geolocalización** para encontrar estaciones cercanas
- **Visualización de rutas** sobre el mapa con colores diferenciados
- **Panel de estación** al hacer clic, mostrando rutas disponibles con:
  - Indicador de horario activo (🟢) o inactivo (🔴) en tiempo real
  - Horarios por convención (L-S, L-V, D-F, S)
  - Tipo de servicio (TransMilenio, TransMiZonal)
- **Seguimiento de buses** en tiempo real sobre la ruta seleccionada
- **ETA estimado** basado en la posición del bus más cercano

### 🔀 Comparación de Rutas (Multi-Ruta)
Una funcionalidad que **no existe en la app oficial**: seleccionar múltiples rutas y verlas simultáneamente en el mapa con colores diferentes. Útil para:
- Comparar recorridos entre dos rutas que van al mismo destino
- Planificar transbordos visualizando rutas superpuestas
- Identificar puntos de intersección entre rutas

### 🔍 Explorar el Sistema
- **Troncales**: Listado completo de troncales con sus estaciones
- **Zonas**: Exploración por zonas zonales del sistema
- **Paradas**: Búsqueda y visualización de paradas zonales
- Navegación por tabs con diseño limpio

### ⭐ Favoritos
- Guardar rutas frecuentes para acceso rápido
- Información de tipo de servicio y fecha de guardado
- Ver todas las rutas favoritas en el mapa simultáneamente
- Compartir rutas con otros usuarios

### 🎨 Temas
- **Modo oscuro y claro** adaptativo en toda la aplicación
- Logo oficial de TransMilenio adaptativo al tema
- Interfaz consistente usando tokens semánticos de shadcn/ui

---

## 🛠️ Stack Tecnológico

| Tecnología | Uso |
|---|---|
| **Next.js 16** | Framework React con App Router y Turbopack |
| **React 19** | UI con hooks y componentes funcionales |
| **TypeScript 5** | Tipado estático para robustez |
| **Tailwind CSS 4** | Estilos utilitarios y sistema de diseño |
| **shadcn/ui** | Componentes base accesibles (Button, Input, Skeleton, Tabs) |
| **Mapbox GL JS** | Renderizado de mapas, clusters y rutas geoespaciales |
| **localStorage** | Persistencia de favoritos, historial y preferencias |

---

## 📁 Estructura del Proyecto

```
src/
├── app/                    # Pages y API routes (Next.js App Router)
│   ├── page.tsx            # Inicio — búsqueda, saldo, favoritos
│   ├── mapa/               # Mapa interactivo con buses y rutas
│   ├── explorar/           # Explorador de troncales, zonas, paradas
│   ├── favoritos/          # Listado de rutas favoritas
│   └── api/                # Proxy API routes
│       ├── buses/          # Posición de buses en tiempo real
│       ├── routes/         # Búsqueda y detalle de rutas
│       ├── estaciones/     # Rutas por estación
│       ├── stations/       # Listado de estaciones
│       ├── paradas/        # Paradas zonales
│       ├── troncales/      # Troncales y sus detalles
│       ├── zonas/          # Zonas zonales
│       ├── saldo/          # Consulta de saldo TuLlave
│       └── servicios/      # Tipos de servicio
├── components/
│   ├── home/               # SaldoCard
│   ├── layout/             # AppHeader, BottomNav
│   ├── mapa/               # StationExplorer, MapMarkers
│   ├── search/             # SearchBar, RouteCard
│   └── ui/                 # shadcn/ui + TransMiLogo
├── hooks/                  # Custom React hooks
│   ├── useFavorites.ts     # Gestión de favoritos (localStorage)
│   ├── useGeolocation.ts   # API de geolocalización del navegador
│   ├── useRouteSearch.ts   # Búsqueda de rutas con debounce
│   ├── useSearchHistory.ts # Historial de búsquedas recientes
│   └── useSelectedRoutes.ts # Selección multi-ruta
├── services/
│   └── transmilenio.ts     # Cliente API centralizado
├── types/                  # Interfaces TypeScript
└── utils/                  # Constantes y utilidades
```

---

## 🚀 Instalación y Uso

### Requisitos previos
- Node.js 18+
- pnpm (recomendado) o npm

### Configuración

```bash
# 1. Clonar el repositorio
git clone <repo-url>
cd transmi-maps-v2

# 2. Instalar dependencias
pnpm install

# 3. Configurar variables de entorno
cp .env.example .env.local
# Editar .env.local con tu token de Mapbox y URL de API

# 4. Iniciar en desarrollo
pnpm dev
```

La aplicación estará disponible en `http://localhost:3000`.

### Variables de entorno

| Variable | Requerida | Descripción |
|---|---|---|
| `NEXT_PUBLIC_MAPBOX_TOKEN` | ✅ Sí | Token de acceso de [Mapbox GL](https://account.mapbox.com/access-tokens/) para renderizar el mapa |
| `BUS_API_TOKEN` | ✅ Sí | Token de autenticación (`x-auth-token`) para la API de TransMilenio (buses, saldo, servicios) |
| `PROXY_BASE` | ❌ Opcional | URL de un proxy CORS para redirigir las peticiones a la API de TransMilenio (ver abajo) |

#### Sobre `PROXY_BASE` y `BUS_API_TOKEN`

Todas las rutas API que se comunican con `tmsa-transmiapp-shvpc.uc.r.appspot.com` (`/api/buses`, `/api/saldo`, `/api/servicios`) usan estas dos variables:

- **`BUS_API_TOKEN`** — Token de autenticación requerido para todas las peticiones a la API de TransMilenio. Se envía como header `x-auth-token`.
- **`PROXY_BASE`** — URL de un proxy que reenvía las peticiones. Si la app se despliega **dentro de Colombia**, funciona directamente sin proxy. Si estás **fuera de Colombia** (o tienes bloqueo de red), necesitas configurar esta variable.

```bash
# Ejemplo .env
NEXT_PUBLIC_MAPBOX_TOKEN=pk.xxx
BUS_API_TOKEN=tu-token-aqui

# Sin proxy (Colombia) — funciona directo
PROXY_BASE=

# Con proxy (fuera de Colombia)
PROXY_BASE=https://tu-proxy.ejemplo.com/proxy/
```

Cuando `PROXY_BASE` está configurado, las peticiones se redirigen así:
```
PROXY_BASE?url=https://tmsa-transmiapp-shvpc.uc.r.appspot.com/endpoint
```

Si `PROXY_BASE` no está definido, la app llama directamente a la API sin intermediarios.

---

## 📱 Capturas

La aplicación está diseñada como **mobile-first** con navegación inferior tipo app nativa:

- **Inicio** → Búsqueda rápida, saldo TuLlave, favoritos
- **Explorar** → Troncales, zonas y paradas del sistema
- **Mapa** → Mapa interactivo con estaciones, rutas y buses
- **Favoritos** → Rutas guardadas con acceso directo

---

## 🎓 Aprendizajes Clave

Este proyecto fue una oportunidad para explorar:

1. **Mapbox GL JS**: Renderizado de mapas vectoriales, clusters, GeoJSON, capas de líneas y puntos animados
2. **Next.js App Router**: Server components, API routes como proxy, streaming y loading states
3. **shadcn/ui**: Sistema de componentes basado en Radix UI con theming semántico
4. **Diseño Mobile-First**: Bottom navigation, safe areas, gestos táctiles, viewport optimizado
5. **APIs REST de transporte**: Estructura de datos de rutas, estaciones, horarios y posiciones GPS
6. **Geolocalización web**: API de `navigator.geolocation` con manejo de permisos
7. **Estado del cliente**: LocalStorage para persistencia sin backend, React hooks personalizados

---

## 📄 Licencia

Este proyecto es de uso **exclusivamente educativo**. No cuenta con licencia comercial. Los datos y la marca TransMilenio pertenecen a **TransMilenio S.A.**

---

<p align="center">
  <em>Hecho con ❤️ como proyecto de aprendizaje — Bogotá, Colombia 🇨🇴</em>
</p>
