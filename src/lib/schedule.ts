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

/** Whether a schedule convention (L-S, L-V, D-F, S…) applies to a given weekday (0 = Sunday; pass serviceDay() so festivos count as Sunday). */
export function conventionAppliesTo(convencion: string, day: number): boolean {
    const conv = convencion?.toUpperCase().trim() || '';
    if (conv === 'L-S') return day >= 1 && day <= 6;
    if (conv === 'L-V') return day >= 1 && day <= 5;
    if (conv === 'S' || conv === 'SAB' || conv === 'SABADO' || conv === 'SÁBADO') return day === 6;
    if (conv === 'D-F' || conv === 'DOM' || conv === 'DOMINGO' || conv.includes('FESTIV') || conv === 'D' || conv === 'DOM-FES') return day === 0;
    return true;
}

// ─── Colombian public holidays ("festivos") ──────────────

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Easter Sunday (Gregorian calendar, anonymous algorithm). */
function easter(year: number): Date {
    const a = year % 19, b = Math.floor(year / 100), c = year % 100;
    const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month - 1, day);
}

const holidayCache = new Map<number, Set<string>>();

/**
 * Colombia's festivos for a year as "YYYY-MM-DD". Most move to the following
 * Monday (Ley Emiliani); Holy Thursday and Good Friday follow Easter.
 */
export function colombianHolidays(year: number): Set<string> {
    const cached = holidayCache.get(year);
    if (cached) return cached;
    const date = (month: number, day: number) => new Date(year, month - 1, day);
    const nextMonday = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + ((8 - d.getDay()) % 7));
    const plus = (d: Date, days: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
    const e = easter(year);
    const days = [
        date(1, 1), date(5, 1), date(7, 20), date(8, 7), date(12, 8), date(12, 25),
        ...[date(1, 6), date(3, 19), date(6, 29), date(8, 15), date(10, 12), date(11, 1), date(11, 11)].map(nextMonday),
        plus(e, -3), plus(e, -2), // Jueves y Viernes Santo
        plus(e, 43), plus(e, 64), plus(e, 71), // Ascensión, Corpus Christi, Sagrado Corazón (already Mondays)
    ];
    const set = new Set(days.map(ymd));
    holidayCache.set(year, set);
    return set;
}

export function isHoliday(date: Date): boolean {
    return colombianHolidays(date.getFullYear()).has(ymd(date));
}

/** Weekday for timetables (0 = Sunday): on a festivo the system runs its Sunday service. */
export function serviceDay(date: Date): number {
    return isHoliday(date) ? 0 : date.getDay();
}

// ─── Opening hours ───────────────────────────────────────

export interface WeeklyHours {
    /** Monday to Friday, Saturday, Sunday and holidays: "08:00-21:00" or "Sin Servicio" */
    wk: string;
    sat: string;
    hol: string;
}

/** Is a place open at `now`, and until when (minutes after midnight; past 24 h when it closes after midnight)? */
export function openingState(hours: WeeklyHours, now = bogotaNow()): { open: boolean; closesAt: number | null } {
    const day = serviceDay(now);
    const range = (day === 0 ? hours.hol : day === 6 ? hours.sat : hours.wk) || '';
    const match = range.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
    if (!match) return { open: false, closesAt: null };
    const start = +match[1] * 60 + +match[2];
    let end = +match[3] * 60 + +match[4];
    if (end <= start) end += 24 * 60; // closes after midnight
    const nowMin = now.getHours() * 60 + now.getMinutes();
    if (nowMin >= start && nowMin < end) return { open: true, closesAt: end };
    // Still inside last night's late opening
    if (nowMin + 24 * 60 < end) return { open: true, closesAt: end - 24 * 60 };
    return { open: false, closesAt: null };
}

export function operatesToday(horarios?: ScheduleEntry[] | null): boolean {
    if (!horarios?.length) return true;
    const day = serviceDay(bogotaNow());
    return horarios.some((h) => conventionAppliesTo(h.convencion, day));
}

/** `null` when the route has no schedule data. */
export function isActiveNow(horarios?: ScheduleEntry[] | null): boolean | null {
    if (!horarios?.length) return null;
    const now = bogotaNow();
    const day = serviceDay(now);
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
