export interface ScheduleEntry {
    convencion: string;
    hora_inicio: string;
    hora_fin: string;
}

/** Current time in Bogotá (UTC-5, no DST) regardless of the device timezone. */
export function bogotaNow(date = new Date()): Date {
    const utc = date.getTime() + date.getTimezoneOffset() * 60000;
    return new Date(utc - 5 * 3600000);
}

/** "4:30 AM" / "11:00 PM" / "16:45" → minutes after midnight. */
export function parseClock(t: string): number {
    const match = t?.match(/(\d+):(\d+)\s*(AM|PM)?/i);
    if (!match) return 0;
    let h = parseInt(match[1]);
    const m = parseInt(match[2]);
    const period = match[3]?.toUpperCase();
    if (period === 'PM' && h < 12) h += 12;
    if (period === 'AM' && h === 12) h = 0;
    return h * 60 + m;
}

export function formatClock(t: string): string {
    const total = parseClock(t);
    const h = Math.floor(total / 60);
    const m = total % 60;
    return `${h}:${String(m).padStart(2, '0')}`;
}

/** Whether a schedule convention (L-S, L-V, D-F, S…) applies to a given weekday (0 = Sunday). */
export function conventionAppliesTo(convencion: string, day: number): boolean {
    const conv = convencion?.toUpperCase().trim() || '';
    if (conv === 'L-S') return day >= 1 && day <= 6;
    if (conv === 'L-V') return day >= 1 && day <= 5;
    if (conv === 'S' || conv === 'SAB' || conv === 'SABADO' || conv === 'SÁBADO') return day === 6;
    if (conv === 'D-F' || conv === 'DOM' || conv === 'DOMINGO' || conv.includes('FESTIV') || conv === 'D' || conv === 'DOM-FES') return day === 0;
    return true;
}

export function operatesToday(horarios?: ScheduleEntry[] | null): boolean {
    if (!horarios?.length) return true;
    const day = bogotaNow().getDay();
    return horarios.some((h) => conventionAppliesTo(h.convencion, day));
}

/** `null` when the route has no schedule data. */
export function isActiveNow(horarios?: ScheduleEntry[] | null): boolean | null {
    if (!horarios?.length) return null;
    const now = bogotaNow();
    const day = now.getDay();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    return horarios.some((h) => {
        if (!conventionAppliesTo(h.convencion, day)) return false;
        const start = parseClock(h.hora_inicio);
        const end = parseClock(h.hora_fin);
        return end >= start ? nowMin >= start && nowMin <= end : nowMin >= start || nowMin <= end;
    });
}

export const CONVENTION_LABELS: Record<string, string> = {
    'L-S': 'Lunes a sábado',
    'L-V': 'Lunes a viernes',
    'D-F': 'Domingos y festivos',
    'S': 'Sábados',
};

export function addMinutes(date: Date, minutes: number): Date {
    return new Date(date.getTime() + minutes * 60000);
}

export function formatTime(date: Date): string {
    return date.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit', hour12: true }).replace(/\s?([ap])\.?\s?m\.?/i, ' $1m');
}

/** Coarse period of the day in Bogotá, used for greetings and the map light preset. */
export function dayPeriod(date = bogotaNow()): 'dawn' | 'day' | 'dusk' | 'night' {
    const m = date.getHours() * 60 + date.getMinutes();
    // Bogotá is equatorial: sunrise ≈ 5:45, sunset ≈ 18:00 all year.
    if (m >= 5 * 60 + 15 && m < 6 * 60 + 15) return 'dawn';
    if (m >= 6 * 60 + 15 && m < 17 * 60 + 35) return 'day';
    if (m >= 17 * 60 + 35 && m < 18 * 60 + 35) return 'dusk';
    return 'night';
}
