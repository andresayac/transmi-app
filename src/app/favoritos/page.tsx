'use client';

import { useRouter } from 'next/navigation';
import AppHeader from '@/components/layout/AppHeader';
import { Button } from '@/components/ui/button';
import { useFavorites } from '@/hooks/useFavorites';
import { useToast } from '@/components/ui/Toast';
import { shareRoute } from '@/utils/share';
import { ROUTE_COLORS } from '@/utils/constants';

function timeAgo(dateStr: string): string {
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return '';
        const diff = Math.floor((Date.now() - d.getTime()) / 1000);
        if (diff < 60) return 'Hace un momento';
        if (diff < 3600) return `Hace ${Math.floor(diff / 60)} min`;
        if (diff < 86400) return `Hace ${Math.floor(diff / 3600)}h`;
        const days = Math.floor(diff / 86400);
        if (days === 1) return 'Ayer';
        if (days < 30) return `Hace ${days} días`;
        return `Hace ${Math.floor(days / 30)} mes${Math.floor(days / 30) > 1 ? 'es' : ''}`;
    } catch {
        return '';
    }
}

export default function FavoritesPage() {
    const router = useRouter();
    const { favorites, removeFavorite } = useFavorites();
    const toast = useToast();

    const handleSelect = (fav: { id: string; nombre: string; codigo: string }) => {
        const params = new URLSearchParams({
            id: fav.id,
            nombre: fav.nombre,
            codigo: fav.codigo,
        });
        router.push(`/mapa?${params.toString()}`);
    };

    const handleRemove = (e: React.MouseEvent, id: string, codigo: string) => {
        e.stopPropagation();
        removeFavorite(id);
        toast.show(`${codigo} eliminada de favoritos`, 'info');
    };

    const handleShare = async (e: React.MouseEvent, fav: { id: string; nombre: string; codigo: string }) => {
        e.stopPropagation();
        const result = await shareRoute(fav);
        if (result.success && result.method === 'clipboard') {
            toast.show('Enlace copiado', 'success');
        }
    };

    const handleViewAllOnMap = () => {
        if (favorites.length === 0) return;
        const mapped = favorites.map((f, i) => ({
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
        <div className="safe-bottom">
            <AppHeader />

            <div className="px-4 pt-4 pb-2">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-foreground">
                            Favoritos
                        </h2>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                            {favorites.length} ruta{favorites.length !== 1 ? 's' : ''} guardada{favorites.length !== 1 ? 's' : ''}
                        </p>
                    </div>
                    {favorites.length >= 2 && (
                        <Button
                            onClick={handleViewAllOnMap}
                            size="sm"
                            className="h-8 rounded-lg text-[11px] font-semibold px-3"
                        >
                            Ver todas en mapa
                        </Button>
                    )}
                </div>
            </div>

            {favorites.length === 0 ? (
                <div className="px-4 pt-16 text-center">
                    <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-secondary flex items-center justify-center">
                        <svg className="w-7 h-7 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                        </svg>
                    </div>
                    <p className="text-foreground font-semibold text-[15px] mb-1">Sin favoritos aún</p>
                    <p className="text-muted-foreground text-xs max-w-[220px] mx-auto mb-6">
                        Guarda tus rutas frecuentes para acceder rápido
                    </p>
                    <Button
                        onClick={() => router.push('/')}
                        variant="secondary"
                        className="rounded-lg h-9 text-xs font-semibold px-5"
                    >
                        Buscar rutas
                    </Button>
                </div>
            ) : (
                <div className="px-4 py-2">
                    <div className="border border-border rounded-xl overflow-hidden divide-y divide-border">
                        {favorites.map((fav) => (
                            <div
                                key={fav.id}
                                onClick={() => handleSelect(fav)}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => { if (e.key === 'Enter') handleSelect(fav); }}
                                className="w-full flex items-center gap-3 px-3.5 py-3 text-left hover:bg-accent/50 active:bg-accent transition-colors cursor-pointer"
                            >
                                {/* Route badge */}
                                <span
                                    className="px-2 py-0.5 rounded text-white text-[11px] font-bold shrink-0"
                                    style={{ backgroundColor: fav.color || '#525252' }}
                                >
                                    {fav.codigo}
                                </span>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <p className="text-foreground text-[13px] font-medium truncate">{fav.nombre}</p>
                                    <p className="text-muted-foreground text-[10px]">
                                        {fav.tipo || 'Ruta'}
                                        {fav.addedAt && <> · Guardada {timeAgo(fav.addedAt)}</>}
                                    </p>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-0.5 shrink-0">
                                    <button
                                        onClick={(e) => handleShare(e, fav)}
                                        className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                                    >
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                                        </svg>
                                    </button>
                                    <button
                                        onClick={(e) => handleRemove(e, fav.id, fav.codigo)}
                                        className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                    >
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
