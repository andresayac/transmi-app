async function shareOrCopy(data: { title: string; text: string; url: string }) {
    if (navigator.share) {
        try {
            await navigator.share(data);
            return { success: true, method: 'native' as const };
        } catch (err) {
            if ((err as Error).name === 'AbortError') {
                return { success: false, method: 'cancelled' as const };
            }
        }
    }

    try {
        await navigator.clipboard.writeText(data.url);
        return { success: true, method: 'clipboard' as const };
    } catch {
        return { success: false, method: 'failed' as const };
    }
}

export async function shareRoute(route: { id: string; nombre: string; codigo: string }) {
    const params = new URLSearchParams({ id: route.id, nombre: route.nombre, codigo: route.codigo });
    return shareOrCopy({
        title: `TransMi · ${route.codigo}`,
        text: `Mira la ruta ${route.codigo} – ${route.nombre} y sus buses en vivo`,
        url: `${window.location.origin}/mapa?${params.toString()}`,
    });
}

export async function shareLink(title: string, text: string, path: string) {
    return shareOrCopy({ title, text, url: `${window.location.origin}${path}` });
}
