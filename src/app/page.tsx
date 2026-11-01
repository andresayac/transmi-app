'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, Search } from 'lucide-react';
import AppHeader from '@/components/layout/AppHeader';
import PlannerHero from '@/components/home/PlannerHero';
import NearbyStation from '@/components/home/NearbyStation';
import SaldoCard from '@/components/home/SaldoCard';
import WeatherChip from '@/components/home/WeatherChip';
import AssistantOrb from '@/components/brand/AssistantOrb';
import RouteBadge from '@/components/transit/RouteBadge';
import { useAppStore, useHydrated } from '@/stores/app';
import { bogotaNow } from '@/lib/schedule';
import { ROUTE_COLORS } from '@/utils/constants';

function greeting(): string {
  const h = bogotaNow().getHours();
  if (h >= 5 && h < 12) return 'Buenos días';
  if (h >= 12 && h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

/** v2 share links pointed at "/?ruta=…"; send them to the route on the map. */
function LegacyShareRedirect() {
  const params = useSearchParams();
  const router = useRouter();
  useEffect(() => {
    const id = params.get('ruta');
    const codigo = params.get('codigo');
    if (id && codigo) {
      router.replace(`/mapa?${new URLSearchParams({ id, codigo, nombre: params.get('nombre') || '' }).toString()}`);
    }
  }, [params, router]);
  return null;
}

function FavoriteRoutes() {
  const router = useRouter();
  const hydrated = useHydrated();
  const favorites = useAppStore((s) => s.favorites);
  if (!hydrated || favorites.length === 0) return null;

  const openAllOnMap = () => {
    const mapped = favorites.slice(0, 8).map((f, i) => ({
      id: f.id,
      codigo: f.codigo,
      nombre: f.nombre,
      tipoServicio: f.tipo || '',
      color: ROUTE_COLORS[i % ROUTE_COLORS.length],
      originalColor: f.color || '#6b7280',
    }));
    sessionStorage.setItem('multiRoutes', JSON.stringify(mapped));
    router.push('/mapa?multi=true');
  };

  return (
    <section aria-label="Tus rutas">
      <div className="flex items-baseline justify-between mb-2">
        <h2 className="font-signage text-[22px] font-bold">Tus rutas</h2>
        {favorites.length > 1 && (
          <button onClick={openAllOnMap} className="text-[14px] font-medium text-muted-foreground hover:text-foreground">
            Ver todas en el mapa
          </button>
        )}
      </div>
      <div className="flex gap-2 overflow-x-auto scrollbar-hidden -mx-4 px-4 pb-1">
        {favorites.map((f) => (
          <Link
            key={f.id}
            href={`/mapa?${new URLSearchParams({ id: f.id, nombre: f.nombre, codigo: f.codigo }).toString()}`}
            className="flex items-center gap-2.5 h-14 pl-2.5 pr-4 rounded-2xl border border-border hover:bg-accent active:scale-[0.97] transition shrink-0"
          >
            <RouteBadge code={f.codigo} color={f.color} size="md" />
            <span className="font-signage text-[17px] font-semibold max-w-[130px] truncate">{f.nombre}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function RouteSearchShortcut() {
  const router = useRouter();
  const [q, setQ] = useState('');
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (q.trim()) router.push(`/explorar?q=${encodeURIComponent(q.trim())}`);
      }}
      className="relative"
      role="search"
    >
      <label htmlFor="route-search" className="sr-only">Buscar una ruta</label>
      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-muted-foreground" />
      <input
        id="route-search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar ruta: B23, K10, Suba…"
        className="w-full h-12 rounded-2xl bg-secondary pl-11 pr-12 text-[16px] placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-ring"
      />
      {q && (
        <button type="submit" className="absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-xl bg-foreground text-background flex items-center justify-center" aria-label="Buscar">
          <ArrowRight className="w-4 h-4" />
        </button>
      )}
    </form>
  );
}

export default function HomePage() {
  return (
    <div className="safe-bottom">
      <Suspense fallback={null}>
        <LegacyShareRedirect />
      </Suspense>
      <AppHeader />

      <main className="px-4 pt-5 space-y-7">
        <div className="flex items-center justify-between gap-3 min-h-8">
          <p className="text-[15px] text-muted-foreground" suppressHydrationWarning>{greeting()}</p>
          <WeatherChip />
        </div>

        <PlannerHero />

        <NearbyStation />

        <SaldoCard />

        <FavoriteRoutes />

        <Link
          href="/asistente"
          className="flex items-center gap-4 rounded-2xl border border-border p-4 hover:bg-accent/60 active:scale-[0.99] transition"
        >
          <AssistantOrb size={48} breathe />
          <span className="flex-1 min-w-0">
            <span className="block font-signage text-[20px] font-bold leading-tight">Pregúntale al asistente</span>
            <span className="block text-[14px] text-muted-foreground truncate">“¿Cómo llego al Movistar Arena antes de las 7?”</span>
          </span>
          <ArrowRight className="w-5 h-5 text-muted-foreground shrink-0" />
        </Link>

        <section aria-label="Buscar rutas">
          <h2 className="font-signage text-[22px] font-bold mb-2">Buscar una ruta</h2>
          <RouteSearchShortcut />
        </section>
      </main>
    </div>
  );
}
