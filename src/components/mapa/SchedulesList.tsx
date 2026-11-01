import { CalendarClock } from 'lucide-react';
import { bogotaNow, CONVENTION_LABELS, conventionAppliesTo, formatClock, ScheduleEntry } from '@/lib/schedule';
import { cn } from '@/lib/utils';

/** Operating hours per day type, with today's convention marked. */
export default function SchedulesList({ schedules }: { schedules: ScheduleEntry[] }) {
    if (!schedules.length) {
        return (
            <div className="flex items-start gap-3 rounded-2xl bg-secondary p-4 text-[14px] text-muted-foreground">
                <CalendarClock className="w-5 h-5 shrink-0 mt-0.5" />
                Esta ruta no publica horarios. Revisa las llegadas en vivo de cada parada.
            </div>
        );
    }
    const today = bogotaNow().getDay();
    return (
        <ul className="divide-y divide-border rounded-2xl border border-border overflow-hidden">
            {schedules.map((h, i) => {
                const isToday = conventionAppliesTo(h.convencion, today);
                return (
                    <li key={`${h.convencion}-${i}`} className={cn('flex items-center justify-between gap-3 px-4 py-3', isToday && 'bg-accent')}>
                        <div className="min-w-0">
                            <p className="text-[15px] font-semibold">{CONVENTION_LABELS[h.convencion?.toUpperCase().trim()] || h.convencion}</p>
                            {isToday && <p className="text-[12px] text-muted-foreground">Aplica hoy</p>}
                        </div>
                        <p className="font-signage tabular text-[20px] font-bold shrink-0">
                            {formatClock(h.hora_inicio)}–{formatClock(h.hora_fin)}
                        </p>
                    </li>
                );
            })}
        </ul>
    );
}
