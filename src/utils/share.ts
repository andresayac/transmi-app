export async function shareRoute(route: { id: string; nombre: string; codigo: string }) {
    const baseUrl = window.location.origin;
    const params = new URLSearchParams({
        ruta: route.id,
        codigo: route.codigo,
        nombre: route.nombre,
    });
    const url = `${baseUrl}?${params.toString()}`;

    const shareData = {
        title: `TransMilenio - ${route.codigo}`,
        text: `Mira la ruta ${route.codigo} - ${route.nombre} en TransMilenio`,
        url,
    };

    if (navigator.share) {
        try {
            await navigator.share(shareData);
            return { success: true, method: 'native' as const };
        } catch (err) {
            if ((err as Error).name === 'AbortError') {
                return { success: false, method: 'cancelled' as const };
            }
        }
    }

    try {
        await navigator.clipboard.writeText(url);
        return { success: true, method: 'clipboard' as const };
    } catch {
        return { success: false, method: 'failed' as const };
    }
}
