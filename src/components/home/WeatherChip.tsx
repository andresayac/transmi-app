'use client';

import { Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSun, Moon, Sun } from 'lucide-react';
import { useLiveData } from '@/hooks/useLiveData';
import type { WeatherNow } from '@/types/transit';
import { cn } from '@/lib/utils';

function WeatherIcon({ code, isDay, className }: { code: number; isDay: boolean; className?: string }) {
    if (code === 0) return isDay ? <Sun className={className} /> : <Moon className={className} />;
    if (code <= 2) return <CloudSun className={className} />;
    if (code === 3) return <Cloud className={className} />;
    if (code === 45 || code === 48) return <CloudFog className={className} />;
    if (code >= 51 && code <= 57) return <CloudDrizzle className={className} />;
    if (code >= 95) return <CloudLightning className={className} />;
    return <CloudRain className={className} />;
}

export function rainLine(w: WeatherNow): string | null {
    if (w.rainInMin === 0) return 'Está lloviendo: lleva sombrilla';
    if (w.rainInMin !== null) return `Lluvia en ~${w.rainInMin} min`;
    return null;
}

/** Current weather in Bogotá plus the one thing that matters for a trip: is rain coming. */
export default function WeatherChip({ lat, lng, className }: { lat?: number | null; lng?: number | null; className?: string }) {
    const url = lat && lng ? `/api/clima?lat=${lat.toFixed(2)}&lng=${lng.toFixed(2)}` : '/api/clima';
    const { data } = useLiveData<WeatherNow>(url, 10 * 60 * 1000);
    if (!data) return <span className={cn('inline-block h-8 w-28 rounded-full bg-secondary animate-pulse', className)} />;

    const rain = rainLine(data);
    return (
        <span
            className={cn(
                'inline-flex items-center gap-1.5 h-8 pl-2.5 pr-3 rounded-full text-13 font-medium',
                rain ? 'bg-foreground text-background' : 'bg-secondary text-foreground',
                className,
            )}
            title={data.summary}
        >
            <WeatherIcon code={data.code} isDay={data.isDay} className="w-4 h-4" />
            <span className="font-signage text-16 font-bold tabular">{data.temperature}°</span>
            <span className="truncate">{rain || data.summary}</span>
        </span>
    );
}
